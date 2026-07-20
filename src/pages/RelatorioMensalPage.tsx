import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosPorPeriodo } from '../data/pedidos'
import { fetchDespesasPorPeriodo } from '../data/despesas'
import { fetchAppConfig } from '../data/appConfig'
import { lucroPedidoEstimado, receitaPedido } from '../domain/finance'
import type { Despesa, PedidoCliente } from '../types/models'
import { formatBRL } from '../lib/format'
import { monthBoundsLocal } from '../lib/dates'
import { StatusBanner } from '../components/StatusBanner'
import { StatusBadge } from '../components/StatusBadge'

function monthDefault() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMes(v: string) {
  const [y, m] = v.split('-')
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${meses[Number(m) - 1]} ${y}`
}

// ── KPI Card ─────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: '1 1 160px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)', lineHeight: 1 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--fg)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Bar Chart horizontal ──────────────────────────────────
function BarChart({ items }: { items: { label: string; value: number; pct: number }[] }) {
  if (items.length === 0) return <div className="hint" style={{ padding: 16 }}>Sem dados</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 140, fontSize: 12, color: 'var(--fg)', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.label}>{it.label}</div>
          <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 10, overflow: 'hidden' }}>
            <div style={{
              width: `${it.pct}%`,
              height: '100%',
              background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : 'var(--accent)',
              borderRadius: 4,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ width: 80, fontSize: 12, fontWeight: 600, textAlign: 'right', color: i === 0 ? '#ef4444' : 'var(--fg)', flexShrink: 0 }}>{formatBRL(it.value)}</div>
        </div>
      ))}
    </div>
  )
}

export function RelatorioMensalPage() {
  const [monthValue, setMonthValue] = useState(monthDefault)
  const [pedidos, setPedidos]       = useState<PedidoCliente[]>([])
  const [despesas, setDespesas]     = useState<Despesa[]>([])
  const [cfgCustoKg, setCfgCustoKg] = useState(0)
  const [loading, setLoading]       = useState(false)
  const [erro, setErro]             = useState<string | null>(null)

  const bounds = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthBoundsLocal(new Date().getFullYear(), new Date().getMonth() + 1)
    return monthBoundsLocal(y, m)
  }, [monthValue])

  async function recarregar() {
    setLoading(true); setErro(null)
    const [peds, cfg, ds] = await Promise.all([
      fetchPedidosPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end }),
      fetchAppConfig(),
      fetchDespesasPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end }),
    ])
    const e = peds.error ?? cfg.error ?? ds.error ?? null
    if (e) setErro(e)
    setPedidos(peds.data)
    setDespesas(ds.data)
    if (cfg.data) setCfgCustoKg(Number(cfg.data.custo_variavel_estimado_por_kg ?? 0))
    setLoading(false)
  }

  useEffect(() => { void recarregar() }, [monthValue])

  // ── Cálculos ──────────────────────────────────────────
  const kpis = useMemo(() => {
    const ativos = pedidos.filter(p => p.status !== 'cancelado')
    const receita    = ativos.reduce((a, p) => a + receitaPedido(p), 0)
    const pesoTotal  = ativos.reduce((a, p) => a + Number(p.peso_kg), 0)
    const qtd        = ativos.length
    const despTotal  = despesas.reduce((a, d) => a + Number(d.valor), 0)
    const lucro      = receita - despTotal
    const margem     = receita > 0 ? (lucro / receita) * 100 : 0
    const mediaKg    = qtd > 0 ? pesoTotal / qtd : 0
    const custoKgMes = pesoTotal > 0 ? despTotal / pesoTotal : 0
    const custoPorLav= qtd > 0 ? despTotal / qtd : 0
    const ticketMed  = qtd > 0 ? receita / qtd : 0
    const clientes   = new Set(ativos.map(p => p.cliente?.id).filter(Boolean)).size
    const lucroEstim = ativos.reduce((a, p) => a + lucroPedidoEstimado({ pedido: p, custoVariavelEstimadoPorKg: cfgCustoKg }), 0)

    // Maior despesa individual
    const maiorDesp = despesas.length > 0
      ? despesas.reduce((max, d) => Number(d.valor) > Number(max.valor) ? d : max, despesas[0])
      : null

    // Top categorias
    const catMap: Record<string, number> = {}
    despesas.forEach(d => { catMap[d.categoria] = (catMap[d.categoria] ?? 0) + Number(d.valor) })
    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    const maxCat = topCats[0]?.[1] ?? 1

    return { receita, pesoTotal, qtd, despTotal, lucro, margem, mediaKg, custoKgMes, custoPorLav, ticketMed, clientes, lucroEstim, maiorDesp, topCats, maxCat }
  }, [pedidos, despesas, cfgCustoKg])

  // ── Top pedidos por receita ──────────────────────────
  const topPedidos = useMemo(() =>
    [...pedidos]
      .filter(p => p.status !== 'cancelado')
      .sort((a, b) => receitaPedido(b) - receitaPedido(a))
      .slice(0, 5),
    [pedidos]
  )
  // ── Análise de frequência e consumo por cliente ──────
  const analiseClientes = useMemo(() => {
    const ativos = pedidos.filter(p => p.status !== 'cancelado')
    const clienteMap: Record<string, {
      id: string
      nome: string
      frequencia: number
      pesoTotal: number
      receitaTotal: number
    }> = {}

    ativos.forEach(p => {
      const cId = p.cliente?.id || 'anonimo'
      const cNome = p.cliente?.nome || 'Cliente avulso'
      if (!clienteMap[cId]) {
        clienteMap[cId] = {
          id: cId,
          nome: cNome,
          frequencia: 0,
          pesoTotal: 0,
          receitaTotal: 0
        }
      }
      clienteMap[cId].frequencia++
      clienteMap[cId].pesoTotal += Number(p.peso_kg)
      clienteMap[cId].receitaTotal += receitaPedido(p)
    })

    const lista = Object.values(clienteMap)
      .sort((a, b) => b.frequencia - a.frequencia || b.receitaTotal - a.receitaTotal)

    const totalClientesAtivos = lista.length
    const freqMedia = totalClientesAtivos > 0 ? kpis.qtd / totalClientesAtivos : 0
    const kgMedioCliente = totalClientesAtivos > 0 ? kpis.pesoTotal / totalClientesAtivos : 0
    const receitaMediaCliente = totalClientesAtivos > 0 ? kpis.receita / totalClientesAtivos : 0

    return { lista, freqMedia, kgMedioCliente, receitaMediaCliente, totalClientesAtivos }
  }, [pedidos, kpis.qtd, kpis.pesoTotal, kpis.receita])

  return (
    <div className="grid" style={{ gap: 16 }}>
      {/* ── Header ── */}
      <header className="row" style={{ alignItems: 'end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2, marginBottom: 2 }}>Relatório Mensal</h1>
          <div className="hint">Análise detalhada de desempenho, custos e lucro do mês selecionado.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="field" style={{ minWidth: 200, flex: '0 0 auto', margin: 0 }}>
            <label htmlFor="rel-mes">Mês</label>
            <input id="rel-mes" type="month" value={monthValue} onChange={e => setMonthValue(e.target.value)} />
          </div>
          <button className="btn btnIcon" type="button" onClick={() => void recarregar()}
            title="Recarregar" style={{ minWidth: 36, width: 36, height: 36, padding: 0, marginTop: 20 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </header>

      {erro && <StatusBanner kind="error" message={erro} />}
      {loading && <div className="hint" style={{ textAlign: 'center', padding: 12 }}>Carregando...</div>}

      {/* ── KPIs principais ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Visão Geral — {formatMes(monthValue)}</h2>
        </div>
        <div className="panelBody">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <KpiCard label="Pedidos ativos"      value={String(kpis.qtd)}                                             sub={`${kpis.clientes} cliente(s) únicos`} />
            <KpiCard label="Kg total lavado"    value={`${kpis.pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`} sub={`Média: ${kpis.mediaKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg/pedido`} />
            <KpiCard label="Receita total"       value={formatBRL(kpis.receita)}                                      sub={`Ticket médio: ${formatBRL(kpis.ticketMed)}`} color="var(--ok)" />
            <KpiCard label="Despesas totais"     value={formatBRL(kpis.despTotal)}                                    sub={`${despesas.length} lançamento(s)`} color="#f97316" />
            <KpiCard label="Lucro líquido"       value={formatBRL(kpis.lucro)}                                        sub={`Margem: ${kpis.margem.toFixed(1)}%`} color={kpis.lucro >= 0 ? 'var(--ok)' : 'var(--danger)'} />
            <KpiCard label="Lucro estimado"      value={formatBRL(kpis.lucroEstim)}                                   sub="Sem rateio de fixos" color="var(--accent)" />
          </div>
        </div>
      </section>

      {/* ── Métricas operacionais ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Métricas Operacionais</h2>
        </div>
        <div className="panelBody">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <KpiCard label="Custo/kg (despesas)"    value={`${formatBRL(kpis.custoKgMes)}/kg`}  sub="Despesas ÷ peso total" />
            <KpiCard label="Custo por lavagem"       value={formatBRL(kpis.custoPorLav)}          sub="Despesas ÷ pedidos" />
            <KpiCard label="Média kg/pedido"         value={`${kpis.mediaKg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`} sub="Peso médio das entregas" />
            <KpiCard label="Ticket médio"             value={formatBRL(kpis.ticketMed)}            sub="Receita média por pedido" />
          </div>
        </div>
      </section>

      {/* ── Maior despesa + Top categorias ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Maior despesa */}
        <section className="panel" style={{ flex: '1 1 280px' }}>
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Maior Despesa do Mês</h2>
          </div>
          <div className="panelBody">
            {kpis.maiorDesp ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#ef4444' }}>
                  {formatBRL(Number(kpis.maiorDesp.valor))}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)' }}>
                  {kpis.maiorDesp.descricao || '(sem descrição)'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'var(--border)', borderRadius: 6,
                    padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5
                  }}>{kpis.maiorDesp.categoria}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {new Date(`${kpis.maiorDesp.data}T00:00`).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                  Representa {kpis.despTotal > 0 ? ((Number(kpis.maiorDesp.valor) / kpis.despTotal) * 100).toFixed(1) : 0}% do total de despesas
                </div>
              </div>
            ) : (
              <div className="hint">Nenhuma despesa registrada neste mês.</div>
            )}
          </div>
        </section>

        {/* Top categorias */}
        <section className="panel" style={{ flex: '2 1 360px' }}>
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Top Categorias de Despesa</h2>
          </div>
          <div className="panelBody">
            <BarChart
              items={kpis.topCats.map(([label, value]) => ({
                label,
                value,
                pct: kpis.maxCat > 0 ? (value / kpis.maxCat) * 100 : 0,
              }))}
            />
            {kpis.topCats.length === 0 && (
              <div className="hint">Nenhuma despesa registrada neste mês.</div>
            )}
          </div>
        </section>
      </div>

      {/* ── Top pedidos ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Top 5 Pedidos por Receita</h2>
        </div>
        <div className="panelBody">
          {topPedidos.length === 0 ? (
            <div className="hint" style={{ padding: 12 }}>Nenhum pedido neste período.</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="tableWrap desktop-only">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Kg</th>
                      <th>Receita</th>
                      <th>Lucro estimado</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPedidos.map((p, i) => {
                      const luc = lucroPedidoEstimado({ pedido: p, custoVariavelEstimadoPorKg: cfgCustoKg })
                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 700, color: i === 0 ? '#f97316' : 'var(--muted)' }}>#{i + 1}</td>
                          <td>{new Date(`${p.data_pedido}T00:00`).toLocaleDateString('pt-BR')}</td>
                          <td>{p.cliente?.nome ?? '—'}</td>
                          <td>{Number(p.peso_kg).toLocaleString('pt-BR')} kg</td>
                          <td style={{ fontWeight: 600 }}>{formatBRL(receitaPedido(p))}</td>
                          <td><span className={luc >= 0 ? 'valPositive' : 'valNegative'}>{formatBRL(luc)}</span></td>
                          <td><StatusBadge status={p.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="mobile-card-list mobile-only">
                {topPedidos.map((p, i) => {
                  const luc = lucroPedidoEstimado({ pedido: p, custoVariavelEstimadoPorKg: cfgCustoKg })
                  return (
                    <div key={p.id} className="mobile-card">
                      <div className="mobile-card-header">
                        <div>
                          <div className="mobile-card-title">
                            <span style={{ color: i === 0 ? '#f97316' : 'var(--muted)', marginRight: 6, fontWeight: 700 }}>#{i + 1}</span>
                            {p.cliente?.nome ?? '—'}
                          </div>
                          <div className="hint" style={{ fontSize: 11 }}>{new Date(`${p.data_pedido}T00:00`).toLocaleDateString('pt-BR')}</div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mobile-card-body">
                        <div><div className="mobile-card-label">Peso</div><div className="mobile-card-value">{Number(p.peso_kg).toLocaleString('pt-BR')} kg</div></div>
                        <div><div className="mobile-card-label">Receita</div><div className="mobile-card-value" style={{ color: 'var(--ok)', fontWeight: 700 }}>{formatBRL(receitaPedido(p))}</div></div>
                        <div><div className="mobile-card-label">Lucro estimado</div><div className={`mobile-card-value ${luc >= 0 ? 'valPositive' : 'valNegative'}`}>{formatBRL(luc)}</div></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Uso e Frequência por Cliente ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Uso e Frequência por Cliente</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{analiseClientes.totalClientesAtivos} cliente(s) ativo(s)</span>
        </div>
        <div className="panelBody grid" style={{ gap: 16 }}>
          {/* Médias do Comportamento do Cliente */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              borderRadius: 8, padding: '12px 14px', flex: '1 1 180px', minWidth: 0
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Frequência Média</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                {analiseClientes.freqMedia.toFixed(1)} envios / cliente
              </div>
            </div>
            <div style={{
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              borderRadius: 8, padding: '12px 14px', flex: '1 1 180px', minWidth: 0
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Consumo Médio por Cliente</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                {analiseClientes.kgMedioCliente.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg / cliente
              </div>
            </div>
            <div style={{
              background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
              borderRadius: 8, padding: '12px 14px', flex: '1 1 180px', minWidth: 0
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Faturamento Médio por Cliente</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginTop: 2 }}>
                {formatBRL(analiseClientes.receitaMediaCliente)} / cliente
              </div>
            </div>
          </div>

          {/* Tabela de frequência */}
          {analiseClientes.lista.length === 0 ? (
            <div className="hint" style={{ padding: 12 }}>Nenhum cliente ativo neste mês.</div>
          ) : (
            <>
              {/* Desktop */}
              <div className="tableWrap desktop-only">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th style={{ textAlign: 'center' }}>Frequência (Envios)</th>
                      <th style={{ textAlign: 'right' }}>Kg Lavado</th>
                      <th style={{ textAlign: 'right' }}>Média Kg/Envio</th>
                      <th style={{ textAlign: 'right' }}>Faturamento</th>
                      <th style={{ textAlign: 'right' }}>Ticket Médio/Envio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analiseClientes.lista.map(c => {
                      const mediaKg = c.frequencia > 0 ? c.pesoTotal / c.frequencia : 0
                      const ticketMed = c.frequencia > 0 ? c.receitaTotal / c.frequencia : 0
                      return (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.nome}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)' }}>{c.frequencia}</td>
                          <td style={{ textAlign: 'right' }}>{c.pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</td>
                          <td style={{ textAlign: 'right' }}>{mediaKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ok)' }}>{formatBRL(c.receitaTotal)}</td>
                          <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{formatBRL(ticketMed)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="mobile-card-list mobile-only">
                {analiseClientes.lista.map(c => {
                  const mediaKg = c.frequencia > 0 ? c.pesoTotal / c.frequencia : 0
                  const ticketMed = c.frequencia > 0 ? c.receitaTotal / c.frequencia : 0
                  return (
                    <div key={c.id} className="mobile-card">
                      <div className="mobile-card-header">
                        <div className="mobile-card-title">{c.nome}</div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                          {c.frequencia} envio(s)
                        </span>
                      </div>
                      <div className="mobile-card-body">
                        <div>
                          <div className="mobile-card-label">Kg Total</div>
                          <div className="mobile-card-value">{c.pesoTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</div>
                        </div>
                        <div>
                          <div className="mobile-card-label">Média Kg</div>
                          <div className="mobile-card-value">{mediaKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</div>
                        </div>
                        <div>
                          <div className="mobile-card-label">Faturamento</div>
                          <div className="mobile-card-value" style={{ color: 'var(--ok)', fontWeight: 700 }}>{formatBRL(c.receitaTotal)}</div>
                        </div>
                        <div>
                          <div className="mobile-card-label">Tkt Médio</div>
                          <div className="mobile-card-value">{formatBRL(ticketMed)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Lista completa de despesas ── */}
      {despesas.length > 0 && (
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Todas as Despesas do Mês</h2>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{despesas.length} lançamento(s)</span>
          </div>
          <div className="panelBody">
            <div className="tableWrap desktop-only">
              <table>
                <thead>
                  <tr><th>Data</th><th>Categoria</th><th>Descrição / Produto</th><th>Valor</th></tr>
                </thead>
                <tbody>
                  {[...despesas].sort((a, b) => Number(b.valor) - Number(a.valor)).map(d => (
                    <tr key={d.id}>
                      <td>{new Date(`${d.data}T00:00`).toLocaleDateString('pt-BR')}</td>
                      <td><span style={{ background: 'var(--border)', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>{d.categoria}</span></td>
                      <td>{d.descricao || '—'}</td>
                      <td style={{ fontWeight: 600, color: '#ef4444' }}>{formatBRL(Number(d.valor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-card-list mobile-only">
              {[...despesas].sort((a, b) => Number(b.valor) - Number(a.valor)).map(d => (
                <div key={d.id} className="mobile-card">
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-title">{d.descricao || d.categoria}</div>
                      <div className="hint" style={{ fontSize: 11 }}>{d.categoria} · {new Date(`${d.data}T00:00`).toLocaleDateString('pt-BR')}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{formatBRL(Number(d.valor))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
