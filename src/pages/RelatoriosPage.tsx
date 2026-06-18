import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosPorPeriodo } from '../data/pedidos'
import { fetchAppConfig } from '../data/appConfig'
import { lucroPedidoEstimado, receitaPedido, somaDespesas } from '../domain/finance'
import type { PedidoCliente } from '../types/models'
import { formatMesAno, monthBoundsLocal } from '../lib/dates'
import { formatBRL } from '../lib/format'
import { fetchDespesasPorPeriodo } from '../data/despesas'
import { StatusBanner } from '../components/StatusBanner'
import { StatusBadge } from '../components/StatusBadge'

function monthDefault(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function RelatoriosPage() {
  const [monthValue, setMonthValue] = useState(monthDefault)
  const [erro, setErro] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [cfgCustoKg, setCfgCustoKg] = useState(0)
  const [despMes, setDespMes] = useState(0)

  const bounds = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthBoundsLocal(new Date().getFullYear(), new Date().getMonth() + 1)
    return monthBoundsLocal(y, m)
  }, [monthValue])

  async function recarregar() {
    setErro(null)

    const [peds, cfg, ds] = await Promise.all([
      fetchPedidosPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end }),
      fetchAppConfig(),
      fetchDespesasPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end }),
    ])

    const e = peds.error ?? cfg.error ?? ds.error ?? null
    if (e) setErro(e)

    setPedidos(peds.data)
    if (cfg.data) setCfgCustoKg(Number(cfg.data.custo_variavel_estimado_por_kg ?? 0))
    setDespMes(somaDespesas(ds.data))
  }

  useEffect(() => {
    void recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue])

  const kpis = useMemo(() => {
    const lista = pedidos.filter((p) => p.status !== 'cancelado')
    const receita = lista.reduce((a, p) => a + receitaPedido(p), 0)
    const lucroEstimLista = lista.reduce((a, p) => a + lucroPedidoEstimado({ pedido: p, custoVariavelEstimadoPorKg: cfgCustoKg }), 0)
    const lucroCompetencia = receita - despMes
    return { receita, lucroEstimLista, lucroCompetencia, pedidos: lista.length }
  }, [pedidos, cfgCustoKg, despMes])

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header className="row" style={{ alignItems: 'end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Relatórios</h1>
          <div className="hint">
            Resumo financeiro do mês: receita total, despesas, lucro líquido e estimativa de lucro por pedido.
          </div>
        </div>
        <div className="field" style={{ minWidth: 220, flex: '0 0 auto' }}>
          <label htmlFor="mes">Mês</label>
          <input id="mes" type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} />
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Resumo — {formatMesAno(monthValue)}</h2>
          <button className="btn btnIcon" type="button" onClick={() => void recarregar()} title="Recarregar" style={{ minWidth: 36, width: 36, height: 36, padding: 0 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <div className="panelBody grid" style={{ gap: 14 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 180px' }}>
              <div className="statLabel">Pedidos ativos</div>
              <div className="statVal">{kpis.pedidos}</div>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <div className="statLabel">Receita</div>
              <div className="statVal">{formatBRL(kpis.receita)}</div>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <div className="statLabel">Despesas</div>
              <div className="statVal">{formatBRL(despMes)}</div>
            </div>
            <div style={{ flex: '1 1 180px', paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
              <div className="statLabel">Lucro líquido</div>
              <div className={`statVal ${kpis.lucroCompetencia >= 0 ? 'valPositive' : 'valNegative'}`}>
                {formatBRL(kpis.lucroCompetencia)}
              </div>
            </div>
          </div>
          <div className="hint">
            Lucro somando apenas custo variável/kg por pedido, sem rateio de despesas fixas:{' '}
            <strong>{formatBRL(kpis.lucroEstimLista)}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Lucro por pedido</h2>
        </div>
        <div className="panelBody">
          {/* Desktop View */}
          <div className="tableWrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>kg</th>
                  <th>Receita</th>
                  <th>Lucro estimado</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td>{p.cliente?.nome ?? '—'}</td>
                    <td>{Number(p.peso_kg).toLocaleString('pt-BR')}</td>
                    <td>{formatBRL(receitaPedido(p))}</td>
                    <td>
                      {(() => {
                        const luc = lucroPedidoEstimado({ pedido: p, custoVariavelEstimadoPorKg: cfgCustoKg })
                        return <span className={luc >= 0 ? 'valPositive' : 'valNegative'}>{formatBRL(luc)}</span>
                      })()}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {pedidos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="hint">
                      Nenhum pedido neste período.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="mobile-card-list mobile-only">
            {pedidos.map((p) => {
              const luc = lucroPedidoEstimado({ pedido: p, custoVariavelEstimadoPorKg: cfgCustoKg })
              return (
                <div key={p.id} className="mobile-card">
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-title">{p.cliente?.nome ?? '—'}</div>
                      <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>
                        Data: {new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  
                  <div className="mobile-card-body">
                    <div>
                      <div className="mobile-card-label">Peso</div>
                      <div className="mobile-card-value">{Number(p.peso_kg).toLocaleString('pt-BR')} kg</div>
                    </div>
                    <div>
                      <div className="mobile-card-label">Receita</div>
                      <div className="mobile-card-value">{formatBRL(receitaPedido(p))}</div>
                    </div>
                    <div className="mobile-card-body-full" style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, marginTop: 4 }}>
                      <div className="mobile-card-label">Lucro Estimado</div>
                      <div className={`mobile-card-value ${luc >= 0 ? 'valPositive' : 'valNegative'}`}>
                        {formatBRL(luc)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {pedidos.length === 0 && (
              <div className="hint" style={{ textAlign: 'center', padding: 20 }}>
                Nenhum pedido neste período.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
