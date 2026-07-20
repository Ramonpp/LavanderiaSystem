import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosPorAno, fetchDespesasPorAno } from '../data/relatorios'
import { receitaPedido } from '../domain/finance'
import type { Despesa, PedidoCliente } from '../types/models'
import { formatBRL } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function anoDefault() { return new Date().getFullYear() }

type DadosMes = {
  mes: number
  pedidos: number
  kg: number
  receita: number
  despesas: number
  lucro: number
}

// ── Mini bar vertical ─────────────────────────────────────
function MiniBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ width: '100%', height: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div
          title={formatBRL(value)}
          style={{
            width: '70%',
            height: `${pct}%`,
            background: color,
            borderRadius: '3px 3px 0 0',
            transition: 'height 0.4s ease',
            cursor: 'default',
            minHeight: value > 0 ? 4 : 0,
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{MESES[Number(label) - 1] ?? label}</div>
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color?: string; icon: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px', display: 'flex',
      flexDirection: 'column', gap: 4, flex: '1 1 160px', minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--fg)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function RelatorioAnualPage() {
  const [ano, setAno]           = useState(anoDefault)
  const [pedidos, setPedidos]   = useState<PedidoCliente[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState<string | null>(null)

  async function recarregar() {
    setLoading(true); setErro(null)
    const [pRes, dRes] = await Promise.all([fetchPedidosPorAno(ano), fetchDespesasPorAno(ano)])
    const e = pRes.error ?? dRes.error ?? null
    if (e) setErro(e)
    setPedidos(pRes.data)
    setDespesas(dRes.data)
    setLoading(false)
  }

  useEffect(() => { void recarregar() }, [ano])

  // ── Agrega por mês ────────────────────────────────────
  const { porMes, totais, melhorMes, piorMes, maxReceita, maxDespesa, maxKg, topCategoria } = useMemo(() => {
    const porMes: DadosMes[] = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1, pedidos: 0, kg: 0, receita: 0, despesas: 0, lucro: 0
    }))

    pedidos.filter(p => p.status !== 'cancelado').forEach(p => {
      const mes = Number(p.data_pedido.split('-')[1]) - 1
      if (mes < 0 || mes > 11) return
      porMes[mes].pedidos++
      porMes[mes].kg     += Number(p.peso_kg)
      porMes[mes].receita += receitaPedido(p)
    })

    despesas.forEach(d => {
      const mes = Number(d.data.split('-')[1]) - 1
      if (mes < 0 || mes > 11) return
      porMes[mes].despesas += Number(d.valor)
    })

    porMes.forEach(m => { m.lucro = m.receita - m.despesas })

    const totais = porMes.reduce((acc, m) => ({
      pedidos:  acc.pedidos  + m.pedidos,
      kg:       acc.kg       + m.kg,
      receita:  acc.receita  + m.receita,
      despesas: acc.despesas + m.despesas,
      lucro:    acc.lucro    + m.lucro,
    }), { pedidos: 0, kg: 0, receita: 0, despesas: 0, lucro: 0 })

    const ativosM = porMes.filter(m => m.receita > 0)
    const melhorMes = ativosM.length > 0 ? ativosM.reduce((a, b) => b.receita > a.receita ? b : a) : null
    const piorMes   = ativosM.length > 0 ? ativosM.reduce((a, b) => b.lucro   < a.lucro   ? b : a) : null

    const maxReceita  = Math.max(...porMes.map(m => m.receita),  1)
    const maxDespesa  = Math.max(...porMes.map(m => m.despesas), 1)
    const maxKg       = Math.max(...porMes.map(m => m.kg),       1)

    // Top categoria do ano
    const catMap: Record<string, number> = {}
    despesas.forEach(d => { catMap[d.categoria] = (catMap[d.categoria] ?? 0) + Number(d.valor) })
    const topCategoria = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0] ?? null

    // Top produto (maior despesa individual)
    const maiorDesp = despesas.length > 0
      ? despesas.reduce((mx, d) => Number(d.valor) > Number(mx.valor) ? d : mx, despesas[0])
      : null

    return { porMes, totais, melhorMes, piorMes, maxReceita, maxDespesa, maxKg, topCategoria, maiorDesp }
  }, [pedidos, despesas])

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => atual - i)
  }, [])

  return (
    <div className="grid" style={{ gap: 16 }}>
      {/* ── Header ── */}
      <header className="row" style={{ alignItems: 'end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2, marginBottom: 2 }}>Relatório Anual</h1>
          <div className="hint">Visão consolidada mês a mês: receita, despesas, lucro, kg e evolução do negócio.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="field" style={{ flex: '0 0 auto', margin: 0 }}>
            <label htmlFor="rel-ano">Ano</label>
            <select id="rel-ano" value={ano} onChange={e => setAno(Number(e.target.value))}>
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
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

      {/* ── KPIs anuais ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>📊 Totais de {ano}</h2>
        </div>
        <div className="panelBody">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <KpiCard icon="📦" label="Total de pedidos" value={String(totais.pedidos)} sub={`Média: ${totais.pedidos > 0 ? (totais.pedidos / 12).toFixed(1) : 0}/mês`} />
            <KpiCard icon="⚖️" label="Kg total lavado"  value={`${totais.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`} sub={`Média: ${(totais.kg / 12).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg/mês`} />
            <KpiCard icon="💰" label="Receita anual"    value={formatBRL(totais.receita)}  sub={`Média: ${formatBRL(totais.receita / 12)}/mês`} color="var(--ok)" />
            <KpiCard icon="💸" label="Despesas anuais"  value={formatBRL(totais.despesas)} sub={`Média: ${formatBRL(totais.despesas / 12)}/mês`} color="#f97316" />
            <KpiCard icon="📈" label="Lucro anual"      value={formatBRL(totais.lucro)}    sub={`Margem: ${totais.receita > 0 ? ((totais.lucro / totais.receita) * 100).toFixed(1) : 0}%`} color={totais.lucro >= 0 ? 'var(--ok)' : 'var(--danger)'} />
          </div>
        </div>
      </section>

      {/* ── Destaques ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <section className="panel" style={{ flex: '1 1 200px' }}>
          <div className="panelHeader"><h2 style={{ fontSize: 15 }}>🥇 Melhor Mês</h2></div>
          <div className="panelBody">
            {melhorMes ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{MESES_FULL[melhorMes.mes - 1]}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ok)' }}>{formatBRL(melhorMes.receita)}</div>
                <div className="hint">{melhorMes.pedidos} pedido(s) · {melhorMes.kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg</div>
              </div>
            ) : <div className="hint">Sem dados</div>}
          </div>
        </section>

        <section className="panel" style={{ flex: '1 1 200px' }}>
          <div className="panelHeader"><h2 style={{ fontSize: 15 }}>⚠️ Mês com Menor Lucro</h2></div>
          <div className="panelBody">
            {piorMes ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--muted)' }}>{MESES_FULL[piorMes.mes - 1]}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: piorMes.lucro >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{formatBRL(piorMes.lucro)}</div>
                <div className="hint">Receita: {formatBRL(piorMes.receita)} · Desp: {formatBRL(piorMes.despesas)}</div>
              </div>
            ) : <div className="hint">Sem dados</div>}
          </div>
        </section>

        <section className="panel" style={{ flex: '1 1 200px' }}>
          <div className="panelHeader"><h2 style={{ fontSize: 15 }}>🔴 Maior Categoria de Despesa</h2></div>
          <div className="panelBody">
            {topCategoria ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{topCategoria[0]}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{formatBRL(topCategoria[1])}</div>
                <div className="hint">
                  {totais.despesas > 0 ? ((topCategoria[1] / totais.despesas) * 100).toFixed(1) : 0}% do total de despesas no ano
                </div>
              </div>
            ) : <div className="hint">Sem dados</div>}
          </div>
        </section>
      </div>

      {/* ── Gráfico Receita ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>📈 Evolução da Receita — {ano}</h2>
        </div>
        <div className="panelBody">
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 110 }}>
            {porMes.map(m => (
              <MiniBar key={m.mes} value={m.receita} max={maxReceita} color="var(--ok)" label={String(m.mes)} />
            ))}
          </div>
          <div className="hint" style={{ marginTop: 8, fontSize: 11 }}>
            Máximo: {formatBRL(maxReceita)} · Total: {formatBRL(totais.receita)}
          </div>
        </div>
      </section>

      {/* ── Gráfico Despesas ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>💸 Evolução das Despesas — {ano}</h2>
        </div>
        <div className="panelBody">
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 110 }}>
            {porMes.map(m => (
              <MiniBar key={m.mes} value={m.despesas} max={maxDespesa} color="#ef4444" label={String(m.mes)} />
            ))}
          </div>
          <div className="hint" style={{ marginTop: 8, fontSize: 11 }}>
            Máximo: {formatBRL(maxDespesa)} · Total: {formatBRL(totais.despesas)}
          </div>
        </div>
      </section>

      {/* ── Gráfico kg ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>⚖️ Evolução de Kg Lavados — {ano}</h2>
        </div>
        <div className="panelBody">
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 110 }}>
            {porMes.map(m => (
              <MiniBar key={m.mes} value={m.kg} max={maxKg} color="var(--accent)" label={String(m.mes)} />
            ))}
          </div>
          <div className="hint" style={{ marginTop: 8, fontSize: 11 }}>
            Máximo: {maxKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg · Total: {totais.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg
          </div>
        </div>
      </section>

      {/* ── Tabela consolidada ── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>📋 Resumo Mês a Mês — {ano}</h2>
        </div>
        <div className="panelBody">
          {/* Desktop */}
          <div className="tableWrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Pedidos</th>
                  <th>Kg lavados</th>
                  <th>Média kg/pedido</th>
                  <th>Receita</th>
                  <th>Despesas</th>
                  <th>Lucro</th>
                  <th>Margem</th>
                </tr>
              </thead>
              <tbody>
                {porMes.map(m => {
                  const margem = m.receita > 0 ? (m.lucro / m.receita) * 100 : null
                  const mediaKg = m.pedidos > 0 ? m.kg / m.pedidos : 0
                  const isMelhor = melhorMes?.mes === m.mes
                  const isPior = piorMes?.mes === m.mes && piorMes?.lucro < 0
                  return (
                    <tr key={m.mes} style={{ background: isMelhor ? 'rgba(34,197,94,0.07)' : isPior ? 'rgba(239,68,68,0.07)' : undefined }}>
                      <td style={{ fontWeight: 600 }}>
                        {isMelhor && <span title="Melhor mês" style={{ marginRight: 4 }}>🥇</span>}
                        {isPior && <span title="Pior lucro" style={{ marginRight: 4 }}>⚠️</span>}
                        {MESES_FULL[m.mes - 1]}
                      </td>
                      <td>{m.pedidos > 0 ? m.pedidos : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td>{m.kg > 0 ? `${m.kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg` : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td>{mediaKg > 0 ? `${mediaKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg` : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td style={{ fontWeight: 600, color: m.receita > 0 ? 'var(--ok)' : 'var(--muted)' }}>{m.receita > 0 ? formatBRL(m.receita) : '—'}</td>
                      <td style={{ color: m.despesas > 0 ? '#ef4444' : 'var(--muted)' }}>{m.despesas > 0 ? formatBRL(m.despesas) : '—'}</td>
                      <td>
                        {m.receita > 0 || m.despesas > 0
                          ? <span className={m.lucro >= 0 ? 'valPositive' : 'valNegative'}>{formatBRL(m.lucro)}</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td>
                        {margem !== null
                          ? <span style={{ fontWeight: 600, color: margem >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{margem.toFixed(1)}%</span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td>Total {ano}</td>
                  <td>{totais.pedidos}</td>
                  <td>{totais.kg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</td>
                  <td>{totais.pedidos > 0 ? `${(totais.kg / totais.pedidos).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg` : '—'}</td>
                  <td style={{ color: 'var(--ok)' }}>{formatBRL(totais.receita)}</td>
                  <td style={{ color: '#ef4444' }}>{formatBRL(totais.despesas)}</td>
                  <td><span className={totais.lucro >= 0 ? 'valPositive' : 'valNegative'}>{formatBRL(totais.lucro)}</span></td>
                  <td style={{ color: totais.receita > 0 && totais.lucro / totais.receita >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                    {totais.receita > 0 ? `${((totais.lucro / totais.receita) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile */}
          <div className="mobile-card-list mobile-only">
            {porMes.filter(m => m.receita > 0 || m.despesas > 0).map(m => (
              <div key={m.mes} className="mobile-card">
                <div className="mobile-card-header">
                  <div className="mobile-card-title">{MESES_FULL[m.mes - 1]}</div>
                  <span className={m.lucro >= 0 ? 'valPositive' : 'valNegative'} style={{ fontWeight: 700, fontSize: 14 }}>{formatBRL(m.lucro)}</span>
                </div>
                <div className="mobile-card-body">
                  <div><div className="mobile-card-label">Pedidos</div><div className="mobile-card-value">{m.pedidos}</div></div>
                  <div><div className="mobile-card-label">Kg</div><div className="mobile-card-value">{m.kg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div></div>
                  <div><div className="mobile-card-label">Receita</div><div className="mobile-card-value" style={{ color: 'var(--ok)' }}>{formatBRL(m.receita)}</div></div>
                  <div><div className="mobile-card-label">Despesas</div><div className="mobile-card-value" style={{ color: '#ef4444' }}>{formatBRL(m.despesas)}</div></div>
                </div>
              </div>
            ))}
            {porMes.every(m => m.receita === 0 && m.despesas === 0) && (
              <div className="hint" style={{ textAlign: 'center', padding: 20 }}>Nenhum dado para {ano}.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
