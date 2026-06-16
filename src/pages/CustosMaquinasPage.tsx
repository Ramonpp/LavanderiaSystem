import { useEffect, useMemo, useState } from 'react'
import { fetchMaquinas } from '../data/maquinas'
import type { Maquina } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'
import { formatBRL } from '../lib/format'

/* ── Tipos locais ──────────────────────────────────────── */
type ParamsMaquina = {
  potencia_kw: string   // kW consumidos por ciclo (lavagem=motor+aquecimento, secagem=resistência)
  litros_ciclo: string  // litros de água por ciclo (secagem = 0)
  lg_device_id?: string // ID do device no LG ThinQ
}

type ResultadoMaquina = {
  maquina: Maquina
  horas_ciclo: number
  kwh_ciclo: number
  m3_ciclo: number
  custo_energia_ciclo: number
  custo_agua_ciclo: number
  custo_total_ciclo: number
  ciclos_dia: number
  custo_dia: number
  custo_mes: number
  kg_dia: number
  custo_por_kg: number
  litros_ciclo: number
  litros_dia: number
  litros_mes: number
  m3_mes: number
  ciclos_mes: number
}

/* ── Defaults razoáveis ────────────────────────────────── */
const DEF_POTENCIA: Record<Maquina['tipo'], string> = {
  lavagem: '2.5',  // kW típico lavadora semi-industrial
  secagem: '3.5',  // kW típico secadora
}
const DEF_LITROS: Record<Maquina['tipo'], string> = {
  lavagem: '80',  // litros por ciclo de lavagem
  secagem: '0',   // secadora não consome água
}

import { fetchLgEnergyUsage } from '../lib/lgThinq'

function calcular(
  maquinas: Maquina[],
  params: Record<string, ParamsMaquina>,
  tarifaKwh: number,
  tarifaAguaM3: number,
  diasMes: number,
  lgConsumos: Record<string, number>
): ResultadoMaquina[] {
  return maquinas.map((m) => {
    const p = params[m.id] ?? { potencia_kw: DEF_POTENCIA[m.tipo], litros_ciclo: DEF_LITROS[m.tipo] }

    const minutos = Number(m.minutos_por_ciclo ?? 60)
    const horas_ciclo = minutos / 60

    const kw = Math.max(0, Number(String(p.potencia_kw).replace(',', '.')) || 0)
    let kwh_ciclo = kw * horas_ciclo

    const litros = Math.max(0, Number(String(p.litros_ciclo).replace(',', '.')) || 0)
    const m3_ciclo = litros / 1000

    let custo_energia_ciclo = kwh_ciclo * tarifaKwh
    const custo_agua_ciclo    = m3_ciclo * tarifaAguaM3
    let custo_total_ciclo   = custo_energia_ciclo + custo_agua_ciclo

    const ciclos_dia = Number(m.ciclos_por_dia_util)
    let custo_dia  = custo_total_ciclo * ciclos_dia
    let custo_mes  = custo_dia * diasMes
    
    // Sobrescrever se tivermos consumo da LG
    const lgWh = lgConsumos[m.id]
    if (lgWh !== undefined) {
      const lgKwhMes = lgWh / 1000
      const lgCustoEnergiaMes = lgKwhMes * tarifaKwh
      const custo_agua_mes = custo_agua_ciclo * ciclos_dia * diasMes
      custo_mes = lgCustoEnergiaMes + custo_agua_mes
      custo_dia = custo_mes / diasMes
      custo_total_ciclo = custo_dia / ciclos_dia
      custo_energia_ciclo = lgCustoEnergiaMes / (ciclos_dia * diasMes)
      kwh_ciclo = lgKwhMes / (ciclos_dia * diasMes)
    }
    const kg_dia     = Number(m.capacidade_kg) * ciclos_dia
    const custo_por_kg = kg_dia > 0 ? custo_dia / kg_dia : 0

    const litros_ciclo = litros
    const litros_dia   = litros_ciclo * ciclos_dia
    const litros_mes   = litros_dia * diasMes
    const m3_mes       = litros_mes / 1000
    const ciclos_mes   = ciclos_dia * diasMes

    return {
      maquina: m,
      horas_ciclo,
      kwh_ciclo,
      m3_ciclo,
      custo_energia_ciclo,
      custo_agua_ciclo,
      custo_total_ciclo,
      ciclos_dia,
      custo_dia,
      custo_mes,
      kg_dia,
      custo_por_kg,
      litros_ciclo,
      litros_dia,
      litros_mes,
      m3_mes,
      ciclos_mes,
    }
  })
}

function fmt2(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── Componente ────────────────────────────────────────── */
export function CustosMaquinasPage() {
  const [maquinas, setMaquinas]   = useState<Maquina[]>([])
  const [erro, setErro]           = useState<string | null>(null)
  const [msg, setMsg]             = useState<string | null>(null)

  // Parâmetros globais
  const [tarifaKwh,    setTarifaKwh]    = useState(() => {
    try { return localStorage.getItem('lav_custos_tarifaKwh') ?? '0.85' } catch { return '0.85' }
  })  // R$/kWh
  const [tarifaAguaM3, setTarifaAguaM3] = useState(() => {
    try { return localStorage.getItem('lav_custos_tarifaAguaM3') ?? '8.00' } catch { return '8.00' }
  })  // R$/m³
  const [diasMes,      setDiasMes]      = useState(() => {
    try { return localStorage.getItem('lav_custos_diasMes') ?? '22' } catch { return '22' }
  })
  
  const [mesLg, setMesLg] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Parâmetros por máquina: { [id]: { potencia_kw, litros_ciclo, lg_device_id } }
  const [params, setParams] = useState<Record<string, ParamsMaquina>>(() => {
    try {
      const saved = localStorage.getItem('lav_custos_params')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  // Consumo retornado da LG em Watt-hora
  const [lgConsumos, setLgConsumos] = useState<Record<string, number>>({})
  const [buscandoLg, setBuscandoLg] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchMaquinas().then(({ data, error }) => {
      if (error) { setErro(error); return }
      setMaquinas(data.filter((m) => m.ativo))
      
      setParams((prev) => {
        const next = { ...prev }
        let changed = false
        data.filter((m) => m.ativo).forEach((m) => {
          if (!next[m.id]) {
            next[m.id] = {
              potencia_kw:  DEF_POTENCIA[m.tipo],
              litros_ciclo: DEF_LITROS[m.tipo],
              lg_device_id: ''
            }
            changed = true
          }
        })
        return changed ? next : prev
      })
    })
  }, [])

  function salvarPadrao() {
    setMsg(null)
    try {
      localStorage.setItem('lav_custos_tarifaKwh', tarifaKwh)
      localStorage.setItem('lav_custos_tarifaAguaM3', tarifaAguaM3)
      localStorage.setItem('lav_custos_diasMes', diasMes)
      localStorage.setItem('lav_custos_params', JSON.stringify(params))
      setMsg('Padrões salvos.')
    } catch {
      setErro('Não foi possível salvar os padrões neste navegador.')
    }
  }

  function setParam(id: string, field: keyof ParamsMaquina, value: string) {
    setParams((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { potencia_kw: '0', litros_ciclo: '0' }), [field]: value },
    }))
  }

  const kwh = Math.max(0, Number(tarifaKwh.replace(',', '.')) || 0)
  const m3  = Math.max(0, Number(tarifaAguaM3.replace(',', '.')) || 0)
  const dias = Math.max(1, Number(diasMes) || 22)

  const resultados = useMemo(
    () => calcular(maquinas, params, kwh, m3, dias, lgConsumos),
    [maquinas, params, kwh, m3, dias, lgConsumos],
  )

  const totalMes          = resultados.reduce((a, r) => a + r.custo_mes, 0)
  const totalEnergiaMes   = resultados.reduce((a, r) => a + r.custo_energia_ciclo * r.ciclos_dia * dias, 0)
  const totalAguaMes      = resultados.reduce((a, r) => a + r.custo_agua_ciclo * r.ciclos_dia * dias, 0)
  const totalKgDia        = resultados.reduce((a, r) => a + r.kg_dia, 0)
  const custoKgMedio      = totalKgDia > 0 ? (totalMes / dias) / totalKgDia : 0
  const totalLitrosMes    = resultados.reduce((a, r) => a + r.litros_mes, 0)
  const totalM3Mes        = totalLitrosMes / 1000
  const totalCiclosMes    = resultados.reduce((a, r) => a + r.ciclos_mes, 0)

  return (
    <div className="grid" style={{ gap: 16 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.3 }}>Custos de Utilidades</h1>
        <p className="hint" style={{ marginTop: 4 }}>
          Estimativa de consumo de energia elétrica e água por máquina, com base na potência (kW),
          duração do ciclo e litros consumidos. Ajuste as tarifas conforme sua conta.
        </p>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      {/* ── Parâmetros globais ─── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Tarifas e referências</h2>
          <button className="btn btnPrimary" type="button" onClick={salvarPadrao}>
            Salvar como padrão
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
              <label htmlFor="dias">Dias úteis por mês</label>
              <input
                id="dias"
                inputMode="numeric"
                type="number"
                min={1}
                max={31}
                value={diasMes}
                onChange={(e) => setDiasMes(e.target.value)}
              />
            </div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            Energia: tarifa média residencial/comercial no Brasil é ~R$ 0,70–1,00/kWh.
            Água: verifique na fatura da concessionária (inclui esgoto se cobrado junto).
          </p>
        </div>
      </section>

      {/* ── KPIs totais ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {/* Custos */}
        <section className="panel">
          <div className="panelBody grid" style={{ gap: 14 }}>
            <div>
              <div className="statLabel">Custo total de utilidades / mês</div>
              <div className="statVal">{formatBRL(totalMes)}</div>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 120px' }}>
                <div className="statLabel">Energia / mês</div>
                <div className="statValSm">{formatBRL(totalEnergiaMes)}</div>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <div className="statLabel">Água / mês</div>
                <div className="statValSm">{formatBRL(totalAguaMes)}</div>
              </div>
            </div>

            {/* Barra energia vs água */}
            {totalMes > 0 && (
              <div>
                <div className="hint" style={{ marginBottom: 6 }}>
                  Composição: {fmt2((totalEnergiaMes / totalMes) * 100)}% energia · {fmt2((totalAguaMes / totalMes) * 100)}% água
                </div>
                <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--border)', display: 'flex' }}>
                  <div
                    style={{
                      width: `${(totalEnergiaMes / totalMes) * 100}%`,
                      background: 'var(--accent)',
                      transition: 'width 500ms ease',
                    }}
                  />
                  <div style={{ flex: 1, background: 'var(--ok)' }} />
                </div>
                <div className="hint" style={{ marginTop: 4, display: 'flex', gap: 14 }}>
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

        {/* Consumo de água em volume */}
        <section className="panel">
          <div className="panelBody grid" style={{ gap: 14 }}>
            <div>
              <div className="statLabel">Consumo total de água / mês</div>
              <div className="statVal" style={{ color: 'var(--ok)' }}>
                {totalLitrosMes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                <span className="hint" style={{ fontSize: 16, marginLeft: 6, fontWeight: 400 }}>L</span>
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                {fmt2(totalM3Mes)} m³ · custo {formatBRL(totalAguaMes)}
              </div>
            </div>

            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 120px' }}>
                <div className="statLabel">Ciclos / mês (todas máqs.)</div>
                <div className="statValSm">
                  {totalCiclosMes.toLocaleString('pt-BR')}
                </div>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <div className="statLabel">Média L / ciclo</div>
                <div className="statValSm">
                  {totalCiclosMes > 0
                    ? fmt2(totalLitrosMes / totalCiclosMes)
                    : '—'} L
                </div>
              </div>
            </div>

            {/* Barra de consumo por máquina */}
            {totalLitrosMes > 0 && resultados.filter((r) => r.litros_mes > 0).length > 0 && (
              <div>
                <div className="hint" style={{ marginBottom: 6 }}>Distribuição por máquina:</div>
                {resultados
                  .filter((r) => r.litros_mes > 0)
                  .map((r) => (
                    <div key={r.maquina.id} style={{ marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span className="hint" style={{ fontSize: 11 }}>{r.maquina.nome}</span>
                        <span className="hint" style={{ fontSize: 11 }}>
                          {r.litros_mes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                          ({fmt2((r.litros_mes / totalLitrosMes) * 100)}%)
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(r.litros_mes / totalLitrosMes) * 100}%`,
                            background: 'var(--ok)',
                            borderRadius: 99,
                            transition: 'width 400ms ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* Custo por kg */}
        <section className="panel">
          <div className="panelBody grid" style={{ gap: 14 }}>
            <div>
              <div className="statLabel">Custo estimado / kg lavado</div>
              <div className="statVal">
                {formatBRL(custoKgMedio)}
                <span className="hint" style={{ fontSize: 14, marginLeft: 6, fontWeight: 400 }}>/kg</span>
              </div>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 120px' }}>
                <div className="statLabel">Kg/dia (total ativo)</div>
                <div className="statValSm">{fmt2(totalKgDia)} kg</div>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <div className="statLabel">Máquinas ativas</div>
                <div className="statValSm">{maquinas.length}</div>
              </div>
            </div>
            <p className="hint">
              Só utilidades (luz + água). Some químicos, mão de obra e outros para o custo real/kg.
            </p>
          </div>
        </section>
      </div>

      {/* ── Configuração por máquina ─── */}
      <section className="panel">
        <div className="panelHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 15 }}>Consumo por máquina</h2>
          <div className="field" style={{ minWidth: 160, margin: 0 }}>
            <label htmlFor="mesLg" style={{ display: 'none' }}>Mês LG ThinQ</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="hint">Mês LG ThinQ:</span>
              <input 
                id="mesLg" 
                type="month" 
                value={mesLg} 
                onChange={(e) => setMesLg(e.target.value)} 
                style={{ padding: '6px 10px', width: 'auto' }}
              />
            </div>
          </div>
        </div>
        <div className="panelBody grid" style={{ gap: 12 }}>
          {maquinas.length === 0 && (
            <p className="hint">Nenhuma máquina ativa cadastrada. Cadastre em Máquinas primeiro.</p>
          )}
          {maquinas.map((m) => {
            const p = params[m.id] ?? { potencia_kw: DEF_POTENCIA[m.tipo], litros_ciclo: DEF_LITROS[m.tipo] }
            const r = resultados.find((x) => x.maquina.id === m.id)
            return (
              <div
                key={m.id}
                style={{
                  background: 'var(--code-bg)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-h)' }}>{m.nome}</div>
                    <div className="hint">
                      {m.tipo} · {Number(m.capacidade_kg).toLocaleString('pt-BR')} kg/ciclo ·{' '}
                      {Number(m.ciclos_por_dia_util).toLocaleString('pt-BR')} ciclos/dia ·{' '}
                      {m.minutos_por_ciclo != null ? `${m.minutos_por_ciclo} min/ciclo` : '60 min/ciclo (padrão)'}
                    </div>
                  </div>
                  {r && (
                    <div style={{ textAlign: 'right' }}>
                      <div className="hint">Custo/mês</div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-h)' }}>{formatBRL(r.custo_mes)}</div>
                    </div>
                  )}
                </div>

                <div className="row">
                  <div className="field">
                    <label>Potência (kW)</label>
                    <input
                      inputMode="decimal"
                      value={p.potencia_kw}
                      onChange={(e) => setParam(m.id, 'potencia_kw', e.target.value)}
                      placeholder={DEF_POTENCIA[m.tipo]}
                    />
                  </div>
                  <div className="field">
                    <label>Água por ciclo (litros)</label>
                    <input
                      inputMode="decimal"
                      value={p.litros_ciclo}
                      onChange={(e) => setParam(m.id, 'litros_ciclo', e.target.value)}
                      placeholder={DEF_LITROS[m.tipo]}
                    />
                  </div>
                </div>

                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label>LG ThinQ Device ID (opcional)</label>
                    <input
                      value={p.lg_device_id ?? ''}
                      onChange={(e) => setParam(m.id, 'lg_device_id', e.target.value)}
                      placeholder="Ex: a62b1df203c4a7188e7..."
                      style={{ fontSize: 12, fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    className="btn"
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 14px', height: 38 }}
                    disabled={!p.lg_device_id || buscandoLg[m.id]}
                    onClick={async () => {
                      if (!p.lg_device_id) return
                      setBuscandoLg((prev) => ({ ...prev, [m.id]: true }))
                      setErro(null)
                      setMsg(null)
                      try {
                        const yyyyMm = mesLg.replace('-', '') // ex: 2026-05 -> 202605
                        const res = await fetchLgEnergyUsage(p.lg_device_id, yyyyMm, yyyyMm)
                        if (res.error) {
                          setErro(res.error)
                        } else if (res.energy_wh !== undefined) {
                          setLgConsumos((prev) => ({ ...prev, [m.id]: res.energy_wh as number }))
                          setMsg(`Consumo LG atualizado para ${m.nome}: ${(res.energy_wh / 1000).toLocaleString('pt-BR')} kWh neste mês.`)
                        }
                      } catch (err) {
                        setErro(String(err))
                      } finally {
                        setBuscandoLg((prev) => ({ ...prev, [m.id]: false }))
                      }
                    }}
                  >
                    {buscandoLg[m.id] ? 'Buscando...' : 'Buscar Consumo LG'}
                  </button>
                </div>
                
                <div className="row">

                  {r && (
                    <>
                      <div className="field" style={{ minWidth: 140 }}>
                        <label>Energia / ciclo</label>
                        <div style={{ padding: '10px', fontWeight: 600, fontSize: 14, color: 'var(--text-h)' }}>
                          {fmt2(r.kwh_ciclo)} kWh = {formatBRL(r.custo_energia_ciclo)}
                        </div>
                      </div>
                      <div className="field" style={{ minWidth: 140 }}>
                        <label>Água / ciclo</label>
                        <div style={{ padding: '10px', fontWeight: 600, fontSize: 14, color: 'var(--text-h)' }}>
                          {fmt2(r.m3_ciclo * 1000)} L = {formatBRL(r.custo_agua_ciclo)}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {r && (
                  <div className="row" style={{ gap: 16 }}>
                    <div>
                      <span className="hint">Custo/ciclo: </span>
                      <strong style={{ color: 'var(--text-h)' }}>{formatBRL(r.custo_total_ciclo)}</strong>
                    </div>
                    <div>
                      <span className="hint">Custo/dia: </span>
                      <strong style={{ color: 'var(--text-h)' }}>{formatBRL(r.custo_dia)}</strong>
                    </div>
                    <div>
                      <span className="hint">Custo/kg: </span>
                      <strong style={{ color: 'var(--text-h)' }}>{formatBRL(r.custo_por_kg)}</strong>
                    </div>
                    <div>
                      <span className="hint">kg/dia: </span>
                      <strong style={{ color: 'var(--text-h)' }}>{fmt2(r.kg_dia)} kg</strong>
                    </div>
                    {r.litros_mes > 0 && (
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          background: 'color-mix(in srgb, var(--ok), transparent 85%)',
                          border: '1px solid color-mix(in srgb, var(--ok), transparent 60%)',
                        }}
                      >
                        <span className="hint">Água/mês: </span>
                        <strong style={{ color: 'var(--ok)' }}>
                          {r.litros_mes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                        </strong>
                        <span className="hint"> ({fmt2(r.m3_mes)} m³)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Tabela resumo ─── */}
      {resultados.length > 0 && (
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Resumo consolidado</h2>
          </div>
          <div className="panelBody">
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Máquina</th>
                    <th>Tipo</th>
                    <th>kWh/ciclo</th>
                    <th>L/ciclo</th>
                    <th style={{ color: 'var(--ok)' }}>L/mês</th>
                    <th style={{ color: 'var(--ok)' }}>m³/mês</th>
                    <th>Custo/ciclo</th>
                    <th>Custo/mês</th>
                    <th>R$/kg</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((r) => {
                    const p = params[r.maquina.id] ?? { potencia_kw: '0', litros_ciclo: '0' }
                    return (
                      <tr key={r.maquina.id}>
                        <td style={{ fontWeight: 600 }}>{r.maquina.nome}</td>
                        <td>
                          <span className={`badge ${r.maquina.tipo === 'lavagem' ? 'badgeBlue' : 'badgeYellow'}`}>
                            {r.maquina.tipo}
                          </span>
                        </td>
                        <td>{fmt2(r.kwh_ciclo)}</td>
                        <td>{String(p.litros_ciclo).replace('.', ',')}</td>
                        <td style={{ fontWeight: 700, color: 'var(--ok)' }}>
                          {r.litros_mes > 0
                            ? r.litros_mes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
                            : '—'}
                        </td>
                        <td style={{ color: 'var(--ok)' }}>
                          {r.m3_mes > 0 ? fmt2(r.m3_mes) : '—'}
                        </td>
                        <td>{formatBRL(r.custo_total_ciclo)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-h)' }}>{formatBRL(r.custo_mes)}</td>
                        <td>{formatBRL(r.custo_por_kg)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700 }}>
                    <td colSpan={3} style={{ color: 'var(--muted)', fontWeight: 600 }}>Total</td>
                    <td />
                    <td style={{ fontWeight: 800, color: 'var(--ok)' }}>
                      {totalLitrosMes.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                    </td>
                    <td style={{ color: 'var(--ok)' }}>{fmt2(totalM3Mes)} m³</td>
                    <td />
                    <td style={{ color: 'var(--text-h)' }}>{formatBRL(totalMes)}</td>
                    <td>{formatBRL(custoKgMedio)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
