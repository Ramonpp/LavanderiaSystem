import { useState, useEffect } from 'react'
import { fetchLgEnergyUsage } from '../lib/lgThinq'
import { StatusBanner } from '../components/StatusBanner'
import { formatBRL } from '../lib/format'
import { upsertResumoMensal, fetchResumoPorMes } from '../data/resumo_mensal'
import { fetchPedidosPorPeriodo } from '../data/pedidos'
import { monthBoundsLocal } from '../lib/dates'
import type { ResumoMensal } from '../types/models'
import { supabase } from '../lib/supabase'
import { fetchMaquinas } from '../data/maquinas'



/* ── Máquinas fixas ────────────────────────────────────────── */
const MAQUINAS = [
  {
    key: 'maq_753',
    nomeDefault: 'Lavadora 753',
    deviceId: 'a62b1df203c4a7188e7880433c9cebfb407c428b5a5a8e0af9dd0f696bee44c1',
  },
  {
    key: 'maq_789',
    nomeDefault: 'Lavadora 789',
    deviceId: '2d6ec2ccc498b22ed9690f16cec2b0d93a0743abb5c3c2c594ecd6bcc1779181',
  },
] as const

type MaqKey = typeof MAQUINAS[number]['key']

type MachineData = {
  apelido: string
  litros_ciclo: string
}

type MonthData = {
  ciclos: string
  consumo_wh: number | null
}

function lsGet(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch {}
}

function loadMachineData(key: MaqKey): MachineData {
  return {
    apelido: lsGet(`lav_${key}_apelido`, ''),
    litros_ciclo: lsGet(`lav_${key}_litros`, '80'),
  }
}

function loadMonthData(key: MaqKey, mes: string): MonthData {
  const whStr = lsGet(`lav_${key}_wh_${mes}`, '')
  return {
    ciclos: lsGet(`lav_${key}_ciclos_${mes}`, ''),
    consumo_wh: whStr !== '' ? Number(whStr) : null,
  }
}

function saveMachineData(key: MaqKey, data: MachineData) {
  lsSet(`lav_${key}_apelido`, data.apelido)
  lsSet(`lav_${key}_litros`, data.litros_ciclo)
}

function saveMonthData(key: MaqKey, mes: string, data: Partial<MonthData>) {
  if (data.ciclos !== undefined) lsSet(`lav_${key}_ciclos_${mes}`, data.ciclos)
  if (data.consumo_wh !== undefined && data.consumo_wh !== null) {
    lsSet(`lav_${key}_wh_${mes}`, String(data.consumo_wh))
  }
}

function fmt2(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ── Componente ────────────────────────────────────────────── */
export function CustosMaquinasPage() {
  const [mes, setMes] = useState(currentMonth)

  const [tarifaKwh, setTarifaKwh] = useState(() => lsGet('lav_custos_tarifaKwh', '0.85'))

  const [machineData, setMachineData] = useState<Record<MaqKey, MachineData>>(() => ({
    maq_753: loadMachineData('maq_753'),
    maq_789: loadMachineData('maq_789'),
  }))

  const [monthData, setMonthData] = useState<Record<MaqKey, MonthData>>(() => ({
    maq_753: loadMonthData('maq_753', currentMonth()),
    maq_789: loadMonthData('maq_789', currentMonth()),
  }))

  const [buscando, setBuscando] = useState<Record<MaqKey, boolean>>({
    maq_753: false,
    maq_789: false,
  })

  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [resumoDb, setResumoDb] = useState<ResumoMensal | null>(null)
  const [machineUuidMap, setMachineUuidMap] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    async function load() {
      const { data } = await fetchResumoPorMes(mes)
      if (active) {
        setResumoDb(data)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [mes])

  // Ensure machines exist in DB and get their UUIDs
  useEffect(() => {
    async function initMachines() {
      const { data: dbMachines } = await fetchMaquinas()
      const mapping: Record<string, string> = {}
      const toInsert = []

      for (const m of MAQUINAS) {
        const nomeExibido = lsGet(`lav_${m.key}_apelido`, '') || m.nomeDefault
        const found = dbMachines?.find(db => 
          db.nome.toLowerCase() === nomeExibido.toLowerCase() || 
          db.nome.toLowerCase() === m.nomeDefault.toLowerCase()
        )
        if (found) {
          mapping[m.key] = found.id
        } else {
          toInsert.push(m)
        }
      }

      if (toInsert.length > 0) {
        for (const m of toInsert) {
          const nomeExibido = lsGet(`lav_${m.key}_apelido`, '') || m.nomeDefault
          await supabase.from('maquina').insert({
            nome: nomeExibido,
            tipo: 'lavagem',
            capacidade_kg: 12,
            ciclos_por_dia_util: 6,
            ativo: true
          })
        }
        const { data: dbMachinesRefetched } = await fetchMaquinas()
        for (const m of MAQUINAS) {
          const nomeExibido = lsGet(`lav_${m.key}_apelido`, '') || m.nomeDefault
          const found = dbMachinesRefetched?.find(db => 
            db.nome.toLowerCase() === nomeExibido.toLowerCase() || 
            db.nome.toLowerCase() === m.nomeDefault.toLowerCase()
          )
          if (found) {
            mapping[m.key] = found.id
          }
        }
      }
      setMachineUuidMap(mapping)
    }
    initMachines()
  }, [])

  // Load machine consumos from DB when month or mapping changes
  useEffect(() => {
    if (Object.keys(machineUuidMap).length === 0) return
    let active = true
    async function loadConsumos() {
      const { data: consumosList, error } = await supabase
        .from('consumo_maquina')
        .select('*')
        .eq('mes_ano', mes)
      
      if (active && !error && consumosList) {
        setMonthData(prev => {
          const next = { ...prev }
          let changed = false
          for (const m of MAQUINAS) {
            const uuid = machineUuidMap[m.key]
            const record = consumosList.find(c => c.maquina_id === uuid)
            if (record) {
              const dbWh = record.consumo_wh
              const dbCiclos = record.ciclos != null ? String(record.ciclos) : ''
              
              if (next[m.key].ciclos !== dbCiclos || next[m.key].consumo_wh !== dbWh) {
                next[m.key] = {
                  ciclos: dbCiclos,
                  consumo_wh: dbWh
                }
                changed = true
                lsSet(`lav_${m.key}_wh_${mes}`, dbWh !== null ? String(dbWh) : '')
                lsSet(`lav_${m.key}_ciclos_${mes}`, dbCiclos)
              }
            }
          }
          return changed ? next : prev
        })
      }
    }
    loadConsumos()
    return () => {
      active = false
    }
  }, [mes, machineUuidMap])



  const kwh = Math.max(0, Number(tarifaKwh.replace(',', '.')) || 0)

  function handleMesChange(novoMes: string) {
    setMes(novoMes)
    setMonthData({
      maq_753: loadMonthData('maq_753', novoMes),
      maq_789: loadMonthData('maq_789', novoMes),
    })
  }

  function updateMachine(key: MaqKey, field: keyof MachineData, value: string) {
    setMachineData((prev) => {
      const next = { ...prev, [key]: { ...prev[key], [field]: value } }
      saveMachineData(key, next[key])
      return next
    })
  }

  async function updateCiclos(key: MaqKey, value: string) {
    setMonthData((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ciclos: value } }
      saveMonthData(key, mes, { ciclos: value })
      return next
    })

    const uuid = machineUuidMap[key]
    if (uuid) {
      const ciclosVal = Math.max(0, Number(value) || 0)
      const currentWh = monthData[key].consumo_wh
      await supabase.from('consumo_maquina').upsert({
        maquina_id: uuid,
        mes_ano: mes,
        consumo_wh: currentWh,
        ciclos: ciclosVal
      }, { onConflict: 'maquina_id,mes_ano' })
    }
  }


  function salvarTarifas() {
    lsSet('lav_custos_tarifaKwh', tarifaKwh)
    setMsg('Tarifa de energia salva.')
  }

  async function buscarLg(key: MaqKey, deviceId: string, nome: string) {
    setBuscando((prev) => ({ ...prev, [key]: true }))
    setErro(null)
    setMsg(null)
    try {
      const yyyyMm = mes.replace('-', '')
      const res = await fetchLgEnergyUsage(deviceId, yyyyMm, yyyyMm)
      if (res.error) {
        setErro(res.error)
      } else if (res.energy_wh !== undefined) {
        const wh = res.energy_wh
        setMonthData((prev) => {
          const next = { ...prev, [key]: { ...prev[key], consumo_wh: wh } }
          saveMonthData(key, mes, { consumo_wh: wh })
          return next
        })

        const uuid = machineUuidMap[key]
        if (uuid) {
          const ciclosVal = Math.max(0, Number(monthData[key].ciclos) || 0)
          await supabase.from('consumo_maquina').upsert({
            maquina_id: uuid,
            mes_ano: mes,
            consumo_wh: wh,
            ciclos: ciclosVal
          }, { onConflict: 'maquina_id,mes_ano' })
        }

        setMsg(`Consumo atualizado para ${nome}: ${fmt2(wh / 1000)} kWh`)
      }
    } catch (err) {
      setErro(String(err))
    } finally {
      setBuscando((prev) => ({ ...prev, [key]: false }))
    }
  }


  /* ── Cálculos de Água Global (Tabela Demais Cidades Prolagos) ── */
  const totalLitros = (Object.keys(monthData) as MaqKey[]).reduce((acc, key) => {
    const md = monthData[key]
    const machine = machineData[key]
    const ciclos = Math.max(0, Number(md.ciclos) || 0)
    const litros = Math.max(0, Number(machine.litros_ciclo.replace(',', '.')) || 0)
    return acc + (litros * ciclos)
  }, 0)

  const totalM3 = totalLitros / 1000

  function calcularCustoAgua(vM3: number): { custo: number; faixa: string; tarifa: number } {
    if (vM3 <= 0) return { custo: 0, faixa: 'Sem consumo', tarifa: 0 }
    if (vM3 <= 10) {
      return { custo: 170.40, faixa: '0 a 10 m³', tarifa: 17.04 }
    } else if (vM3 <= 15) {
      return { custo: vM3 * 22.32, faixa: '11 a 15 m³', tarifa: 22.32 }
    } else if (vM3 <= 25) {
      return { custo: vM3 * 35.74, faixa: '16 a 25 m³', tarifa: 35.74 }
    } else if (vM3 <= 35) {
      return { custo: vM3 * 42.88, faixa: '26 a 35 m³', tarifa: 42.88 }
    } else if (vM3 <= 45) {
      return { custo: vM3 * 51.46, faixa: '36 a 45 m³', tarifa: 51.46 }
    } else if (vM3 <= 55) {
      return { custo: vM3 * 63.18, faixa: '46 a 55 m³', tarifa: 63.18 }
    } else if (vM3 <= 65) {
      return { custo: vM3 * 80.25, faixa: '56 a 65 m³', tarifa: 80.25 }
    } else {
      return { custo: vM3 * 91.26, faixa: 'Acima 65 m³', tarifa: 91.26 }
    }
  }

  const waterCalculated = calcularCustoAgua(totalM3)
  const custoAguaTotal = waterCalculated.custo

  /* ── Cálculos por máquina ──────────────────────────────── */
  type Resultado = {
    kwh_total: number | null
    kwh_ciclo: number | null
    custo_energia_ciclo: number | null
    custo_agua_ciclo: number
    custo_total_ciclo: number
    custo_energia_mes: number
    custo_agua_mes: number
    custo_total_mes: number
    ciclos: number
    litros: number
  }

  function calcular(key: MaqKey): Resultado {
    const md = monthData[key]
    const machine = machineData[key]
    const ciclos = Math.max(0, Number(md.ciclos) || 0)

    const kwh_total = md.consumo_wh !== null ? md.consumo_wh / 1000 : null
    const kwh_ciclo = (kwh_total !== null && ciclos > 0) ? kwh_total / ciclos : null
    const litrosVal = Math.max(0, Number(machine.litros_ciclo.replace(',', '.')) || 0)

    const custo_energia_mes = kwh_total !== null ? kwh_total * kwh : 0
    const custo_energia_ciclo = kwh_ciclo !== null ? kwh_ciclo * kwh : 0

    // Proporcionalização do custo de água
    const litrosMaq = litrosVal * ciclos
    const custo_agua_mes = totalLitros > 0 ? (custoAguaTotal * litrosMaq) / totalLitros : 0
    const custo_agua_ciclo = ciclos > 0 ? custo_agua_mes / ciclos : 0

    const custo_total_ciclo = custo_energia_ciclo + custo_agua_ciclo
    const custo_total_mes = custo_energia_mes + custo_agua_mes

    return {
      kwh_total,
      kwh_ciclo,
      custo_energia_ciclo,
      custo_agua_ciclo,
      custo_total_ciclo,
      custo_energia_mes,
      custo_agua_mes,
      custo_total_mes,
      ciclos,
      litros: litrosVal,
    }
  }

  const resultados: Record<MaqKey, Resultado> = {
    maq_753: calcular('maq_753'),
    maq_789: calcular('maq_789'),
  }

  const totalEnergiaMes = (resultados.maq_753?.custo_energia_mes ?? 0) + (resultados.maq_789?.custo_energia_mes ?? 0)
  const totalAguaMes = custoAguaTotal
  const totalMes = totalEnergiaMes + totalAguaMes
  const totalCiclos = (resultados.maq_753?.ciclos ?? 0) + (resultados.maq_789?.ciclos ?? 0)


  async function salvarResumo() {
    setSalvando(true)
    setErro(null)
    setMsg(null)
    try {
      const [y, m] = mes.split('-').map(Number)
      const bounds = monthBoundsLocal(y, m)
      const { data: peds } = await fetchPedidosPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end })
      const ativos = peds.filter((p) => p.status !== 'cancelado')
      const energyCost = Math.round(totalEnergiaMes * 100) / 100
      const waterCost = Math.round(totalAguaMes * 100) / 100
      const totalPed = ativos.length
      const totalKg = Math.round(ativos.reduce((acc, p) => acc + Number(p.peso_kg ?? 0), 0) * 100) / 100

      const { error } = await upsertResumoMensal({
        mes_ano: mes,
        total_pedidos: totalPed,
        total_kg: totalKg,
        custo_energia: energyCost,
        custo_agua: waterCost,
      })
      if (error) {
        setErro(error)
      } else {
        setMsg(`Resumo de ${mesLabel} salvo no histórico.`)
        setResumoDb({
          id: resumoDb?.id || '',
          mes_ano: mes,
          total_pedidos: totalPed,
          total_kg: totalKg,
          custo_energia: energyCost,
          custo_agua: waterCost,
          criado_em: resumoDb?.criado_em || new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        } as ResumoMensal)
      }
    } catch (err) {
      setErro(String(err))
    } finally {
      setSalvando(false)
    }
  }


  const MESES_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const mesLabel = mes
    ? (() => {
        const [ano, mm] = mes.split('-')
        return `${MESES_PT[parseInt(mm, 10) - 1]} de ${ano}`
      })()
    : ''

  return (
    <div className="grid" style={{ gap: 16 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.3 }}>Custos de Utilidades</h1>
        <p className="hint" style={{ marginTop: 4 }}>
          Consumo de energia via API LG ThinQ + água por ciclo. Informe quantos ciclos foram feitos no mês para calcular a média por ciclo.
        </p>
      </header>

      {erro && <StatusBanner kind="error" message={erro} />}
      {msg && <StatusBanner kind="success" message={msg} />}

      {/* ── Tarifas e mês ─── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Tarifas e período</h2>
          <button className="btn btnPrimary" type="button" onClick={salvarTarifas}>
            Salvar tarifa energia
          </button>
        </div>
        <div className="panelBody">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="field">
              <label htmlFor="kwh">Tarifa energia (R$/kWh)</label>
              <input
                id="kwh"
                inputMode="decimal"
                value={tarifaKwh}
                onChange={(e) => setTarifaKwh(e.target.value)}
                placeholder="0.85"
              />
            </div>
            <div className="field" style={{ minWidth: 280 }}>
              <label>Tarifa de Água (Demais Cidades)</label>
              <div style={{ 
                padding: '10px 12px', 
                background: 'var(--code-bg)', 
                borderRadius: 8, 
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-h)',
                border: '1px solid var(--border)',
                minHeight: 38,
                display: 'flex',
                alignItems: 'center'
              }}>
                Prolagos: {waterCalculated.faixa} → {waterCalculated.tarifa > 0 ? `R$ ${fmt2(waterCalculated.tarifa)}/m³` : '—'}
              </div>
            </div>
            <div className="field">
              <label htmlFor="mes">Mês de referência</label>
              <input
                id="mes"
                type="month"
                value={mes}
                onChange={(e) => handleMesChange(e.target.value)}
                style={{ padding: '10px 12px' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Histórico Salvo no Banco de Dados ─── */}
      {resumoDb && (
        <section className="panel" style={{ borderLeft: '4px solid var(--ok)' }}>
          <div className="panelBody" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ok)', fontWeight: 600 }}>
              <span style={{ fontSize: 16 }}>✓</span>
              <span>Histórico Registrado</span>
            </div>
            <div className="hint" style={{ fontSize: 12 }}>
              Este período está salvo no banco de dados e sincronizado em todos os dispositivos.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginTop: 4 }}>
              <div>
                <span className="hint" style={{ fontSize: 11 }}>Custo de Energia (Luz):</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{formatBRL(resumoDb.custo_energia)}</div>
              </div>
              <div>
                <span className="hint" style={{ fontSize: 11 }}>Custo de Água:</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ok)' }}>{formatBRL(resumoDb.custo_agua)}</div>
              </div>
              <div>
                <span className="hint" style={{ fontSize: 11 }}>Custo Total de Utilidades:</span>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{formatBRL(resumoDb.custo_energia + resumoDb.custo_agua)}</div>
              </div>
              <div>
                <span className="hint" style={{ fontSize: 11 }}>Pedidos Ativos / Peso Total:</span>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{resumoDb.total_pedidos} pedidos ({Number(resumoDb.total_kg).toLocaleString('pt-BR')} kg)</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Cards das máquinas ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {MAQUINAS.map((maq) => {
          const key = maq.key
          const md = machineData[key]
          const month = monthData[key]
          const r = resultados[key]
          const nomeExibido = md.apelido || maq.nomeDefault

          return (
            <section key={key} className="panel">
              <div className="panelHeader">
                <div>
                  <h2 style={{ fontSize: 15 }}>{nomeExibido}</h2>
                  <div className="hint" style={{ fontSize: 11, marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    ID: {maq.deviceId.slice(0, 16)}…
                  </div>
                </div>
                {r && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="hint" style={{ fontSize: 11 }}>Custo total / mês</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>
                      {formatBRL(r.custo_total_mes)}
                    </div>
                  </div>
                )}
              </div>

              <div className="panelBody grid" style={{ gap: 12 }}>
                {/* Apelido */}
                <div className="field">
                  <label>Apelido da máquina</label>
                  <input
                    value={md.apelido}
                    onChange={(e) => updateMachine(key, 'apelido', e.target.value)}
                    placeholder={maq.nomeDefault}
                  />
                </div>

                <div className="row">
                  {/* Água */}
                  <div className="field">
                    <label>Água por ciclo (litros)</label>
                    <input
                      inputMode="decimal"
                      value={md.litros_ciclo}
                      onChange={(e) => updateMachine(key, 'litros_ciclo', e.target.value)}
                      placeholder="80"
                    />
                  </div>

                  {/* Ciclos manuais */}
                  <div className="field">
                    <label>Ciclos em {mesLabel || mes}</label>
                    <input
                      inputMode="numeric"
                      value={month.ciclos}
                      onChange={(e) => updateCiclos(key, e.target.value)}
                      placeholder="Ex: 45"
                    />
                  </div>
                </div>

                {/* Botão LG */}
                <button
                  className="btn btnPrimary"
                  type="button"
                  disabled={buscando[key]}
                  style={{ width: '100%' }}
                  onClick={() => buscarLg(key, maq.deviceId, nomeExibido)}
                >
                  {buscando[key] ? 'Buscando na LG...' : 'Buscar Consumo LG ThinQ'}
                </button>

                {/* Resultado do consumo LG */}
                {month.consumo_wh !== null && (
                  <div style={{
                    background: 'color-mix(in srgb, var(--accent), transparent 90%)',
                    border: '1px solid color-mix(in srgb, var(--accent), transparent 70%)',
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      Consumo LG — {mesLabel}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-h)' }}>
                      {fmt2(month.consumo_wh / 1000)} kWh
                    </div>
                    <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>
                      {month.consumo_wh.toLocaleString('pt-BR')} Wh registrados pela LG
                    </div>
                  </div>
                )}

                {/* Resultado calculado */}
                {r.ciclos > 0 || r.kwh_total !== null ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {/* Linha: energia + água por ciclo */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                    }}>
                      <div style={{ background: 'var(--code-bg)', borderRadius: 8, padding: '10px 12px' }}>
                        <div className="hint" style={{ fontSize: 11 }}>kWh / ciclo (média)</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>
                          {r.kwh_ciclo !== null ? `${fmt2(r.kwh_ciclo)} kWh` : '—'}
                        </div>
                        <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>
                          = {r.custo_energia_ciclo !== null ? formatBRL(r.custo_energia_ciclo) : '—'}
                        </div>
                      </div>
                      <div style={{ background: 'var(--code-bg)', borderRadius: 8, padding: '10px 12px' }}>
                        <div className="hint" style={{ fontSize: 11 }}>Água / ciclo</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ok)', marginTop: 2 }}>
                          {fmt2(r.litros)} L
                        </div>
                        <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>
                          = {formatBRL(r.custo_agua_ciclo)}
                        </div>
                      </div>
                    </div>

                    {/* Custo por ciclo */}
                    <div style={{
                      background: 'var(--code-bg)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div className="hint" style={{ fontSize: 11 }}>Custo total / ciclo</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-h)', marginTop: 2 }}>
                          {formatBRL(r.custo_total_ciclo)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="hint" style={{ fontSize: 11 }}>{r.ciclos} ciclos</div>
                        <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>no mês</div>
                      </div>
                    </div>

                    {/* Composição do mês */}
                    <div style={{
                      background: 'var(--code-bg)',
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}>
                      <div className="hint" style={{ fontSize: 11, marginBottom: 6 }}>Composição mensal</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="hint" style={{ fontSize: 12 }}>Energia</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)' }}>{formatBRL(r.custo_energia_mes)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span className="hint" style={{ fontSize: 12 }}>Água ({(r.litros * r.ciclos).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L)</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ok)' }}>{formatBRL(r.custo_agua_mes)}</span>
                      </div>
                      {r.custo_total_mes > 0 && (
                        <div style={{ height: 6, borderRadius: 99, overflow: 'hidden', background: 'var(--border)', display: 'flex' }}>
                          <div style={{
                            width: `${(r.custo_energia_mes / r.custo_total_mes) * 100}%`,
                            background: 'var(--accent)',
                          }} />
                          <div style={{ flex: 1, background: 'var(--ok)' }} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="hint" style={{ fontSize: 12 }}>
                    Busque o consumo LG ou informe o número de ciclos para calcular os custos desta máquina.
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* ── KPIs consolidados ─── */}
      {(() => {
        const showConsolidado = totalMes > 0 || resumoDb !== null
        const displayTotal = totalMes > 0 ? totalMes : (resumoDb ? (Number(resumoDb.custo_energia) + Number(resumoDb.custo_agua)) : 0)
        const displayEnergia = totalMes > 0 ? totalEnergiaMes : (resumoDb ? Number(resumoDb.custo_energia) : 0)
        const displayAgua = totalMes > 0 ? totalAguaMes : (resumoDb ? Number(resumoDb.custo_agua) : 0)
        const displayCiclos = totalMes > 0 ? totalCiclos : 0

        if (!showConsolidado) return null

        return (
          <section className="panel">
            <div className="panelHeader">
              <h2 style={{ fontSize: 15 }}>
                Consolidado — {mesLabel}{' '}
                {totalMes === 0 && resumoDb && (
                  <span 
                    style={{ 
                      backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                      color: 'rgb(16, 185, 129)', 
                      fontSize: 11, 
                      padding: '2px 8px', 
                      borderRadius: 99,
                      marginLeft: 8,
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    Sincronizado do Banco
                  </span>
                )}
              </h2>
              <button
                className="btn btnPrimary"
                type="button"
                onClick={salvarResumo}
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : 'Registrar no histórico'}
              </button>
            </div>
            <div className="panelBody">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
                <div>
                  <div className="statLabel">Custo total / mês</div>
                  <div className="statVal">{formatBRL(displayTotal)}</div>
                </div>
                <div>
                  <div className="statLabel">Energia (Luz)</div>
                  <div className="statValSm" style={{ color: 'var(--accent)' }}>{formatBRL(displayEnergia)}</div>
                  {totalMes > 0 && (
                    <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                      {machineData.maq_753.apelido || 'Lavadora 753'}: {resultados.maq_753?.kwh_total !== null ? `${fmt2(resultados.maq_753.kwh_total)} kWh` : '—'}<br />
                      {machineData.maq_789.apelido || 'Lavadora 789'}: {resultados.maq_789?.kwh_total !== null ? `${fmt2(resultados.maq_789.kwh_total)} kWh` : '—'}
                    </div>
                  )}
                </div>
                <div>
                  <div className="statLabel">Água</div>
                  <div className="statValSm" style={{ color: 'var(--ok)' }}>{formatBRL(displayAgua)}</div>
                  {totalMes > 0 && (
                    <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                      Total: {fmt2(totalM3)} m³ ({waterCalculated.faixa})<br />
                      Vol. Total: {(totalLitros).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                    </div>
                  )}
                </div>
                <div>
                  <div className="statLabel">Total de ciclos</div>
                  <div className="statValSm">{totalMes > 0 ? displayCiclos.toLocaleString('pt-BR') : '—'}</div>
                  {totalMes > 0 && totalCiclos > 0 && (
                    <div className="hint" style={{ fontSize: 11 }}>
                      Custo médio/ciclo: {formatBRL(displayTotal / totalCiclos)}
                    </div>
                  )}
                </div>
              </div>

              {displayTotal > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="hint" style={{ marginBottom: 6, fontSize: 12 }}>
                    Composição: {fmt2((displayEnergia / displayTotal) * 100)}% energia · {fmt2((displayAgua / displayTotal) * 100)}% água
                  </div>
                  <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--border)', display: 'flex' }}>
                    <div style={{
                      width: `${(displayEnergia / displayTotal) * 100}%`,
                      background: 'var(--accent)',
                      transition: 'width 400ms ease',
                    }} />
                    <div style={{ flex: 1, background: 'var(--ok)' }} />
                  </div>
                  <div className="hint" style={{ marginTop: 6, display: 'flex', gap: 14, fontSize: 11 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', display: 'inline-block' }} />
                      Energia
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--ok)', display: 'inline-block' }} />
                      Água
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )
      })()}
    </div>
  )
}
