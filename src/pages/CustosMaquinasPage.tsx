import { useState } from 'react'
import { fetchLgEnergyUsage } from '../lib/lgThinq'
import { StatusBanner } from '../components/StatusBanner'
import { formatBRL } from '../lib/format'

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
  const [tarifaAguaM3, setTarifaAguaM3] = useState(() => lsGet('lav_custos_tarifaAguaM3', '8.00'))

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

  const kwh = Math.max(0, Number(tarifaKwh.replace(',', '.')) || 0)
  const m3 = Math.max(0, Number(tarifaAguaM3.replace(',', '.')) || 0)

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

  function updateCiclos(key: MaqKey, value: string) {
    setMonthData((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ciclos: value } }
      saveMonthData(key, mes, { ciclos: value })
      return next
    })
  }

  function salvarTarifas() {
    lsSet('lav_custos_tarifaKwh', tarifaKwh)
    lsSet('lav_custos_tarifaAguaM3', tarifaAguaM3)
    setMsg('Tarifas salvas.')
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
        setMsg(`Consumo atualizado para ${nome}: ${fmt2(wh / 1000)} kWh`)
      }
    } catch (err) {
      setErro(String(err))
    } finally {
      setBuscando((prev) => ({ ...prev, [key]: false }))
    }
  }

  /* ── Cálculos por máquina ──────────────────────────────── */
  type Resultado = {
    kwh_total: number
    kwh_ciclo: number
    custo_energia_ciclo: number
    custo_agua_ciclo: number
    custo_total_ciclo: number
    custo_energia_mes: number
    custo_agua_mes: number
    custo_total_mes: number
    ciclos: number
    litros: number
  } | null

  function calcular(key: MaqKey): Resultado {
    const md = monthData[key]
    const machine = machineData[key]
    if (md.consumo_wh === null) return null
    const ciclos = Math.max(1, Number(md.ciclos) || 0)
    if (ciclos === 0) return null

    const kwh_total = md.consumo_wh / 1000
    const kwh_ciclo = kwh_total / ciclos
    const litros = Math.max(0, Number(machine.litros_ciclo.replace(',', '.')) || 0)

    const custo_energia_ciclo = kwh_ciclo * kwh
    const custo_agua_ciclo = (litros / 1000) * m3
    const custo_total_ciclo = custo_energia_ciclo + custo_agua_ciclo
    const custo_energia_mes = kwh_total * kwh
    const custo_agua_mes = (litros / 1000) * ciclos * m3
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
      litros,
    }
  }

  const resultados: Record<MaqKey, Resultado> = {
    maq_753: calcular('maq_753'),
    maq_789: calcular('maq_789'),
  }

  const totalMes = (resultados.maq_753?.custo_total_mes ?? 0) + (resultados.maq_789?.custo_total_mes ?? 0)
  const totalEnergiaMes = (resultados.maq_753?.custo_energia_mes ?? 0) + (resultados.maq_789?.custo_energia_mes ?? 0)
  const totalAguaMes = (resultados.maq_753?.custo_agua_mes ?? 0) + (resultados.maq_789?.custo_agua_mes ?? 0)
  const totalCiclos = (resultados.maq_753?.ciclos ?? 0) + (resultados.maq_789?.ciclos ?? 0)
  const totalKwh = (resultados.maq_753?.kwh_total ?? 0) + (resultados.maq_789?.kwh_total ?? 0)

  const mesLabel = mes
    ? new Date(mes + '-01').toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
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
            Salvar tarifas
          </button>
        </div>
        <div className="panelBody">
          <div className="row">
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
            <div className="field">
              <label htmlFor="agua">Tarifa água (R$/m³)</label>
              <input
                id="agua"
                inputMode="decimal"
                value={tarifaAguaM3}
                onChange={(e) => setTarifaAguaM3(e.target.value)}
                placeholder="8.00"
              />
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
                {r ? (
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
                          {fmt2(r.kwh_ciclo)} kWh
                        </div>
                        <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>
                          = {formatBRL(r.custo_energia_ciclo)}
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
                  month.consumo_wh !== null && (
                    <div className="hint" style={{ fontSize: 12 }}>
                      Informe o número de ciclos para ver o custo por ciclo.
                    </div>
                  )
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* ── KPIs consolidados ─── */}
      {totalMes > 0 && (
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Consolidado — {mesLabel}</h2>
          </div>
          <div className="panelBody">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <div>
                <div className="statLabel">Custo total / mês</div>
                <div className="statVal">{formatBRL(totalMes)}</div>
              </div>
              <div>
                <div className="statLabel">Energia</div>
                <div className="statValSm" style={{ color: 'var(--accent)' }}>{formatBRL(totalEnergiaMes)}</div>
                <div className="hint" style={{ fontSize: 11 }}>{fmt2(totalKwh)} kWh</div>
              </div>
              <div>
                <div className="statLabel">Água</div>
                <div className="statValSm" style={{ color: 'var(--ok)' }}>{formatBRL(totalAguaMes)}</div>
              </div>
              <div>
                <div className="statLabel">Total de ciclos</div>
                <div className="statValSm">{totalCiclos.toLocaleString('pt-BR')}</div>
                <div className="hint" style={{ fontSize: 11 }}>
                  Custo médio/ciclo:{' '}
                  {totalCiclos > 0 ? formatBRL(totalMes / totalCiclos) : '—'}
                </div>
              </div>
            </div>

            {totalMes > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="hint" style={{ marginBottom: 6, fontSize: 12 }}>
                  Composição: {fmt2((totalEnergiaMes / totalMes) * 100)}% energia · {fmt2((totalAguaMes / totalMes) * 100)}% água
                </div>
                <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--border)', display: 'flex' }}>
                  <div style={{
                    width: `${(totalEnergiaMes / totalMes) * 100}%`,
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
      )}
    </div>
  )
}
