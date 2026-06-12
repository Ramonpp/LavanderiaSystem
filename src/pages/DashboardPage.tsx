import { useEffect, useMemo, useState } from 'react'
import { fetchAppConfig } from '../data/appConfig'
import { fetchDespesasPorPeriodo } from '../data/despesas'
import { fetchMaquinas } from '../data/maquinas'
import { fetchPedidosPorPeriodo } from '../data/pedidos'
import { capacidadeKgDia } from '../domain/ops'
import { receitaPedido, somaDespesas } from '../domain/finance'
import type { Maquina, PedidoCliente } from '../types/models'
import { formatMesAno, monthBoundsLocal } from '../lib/dates'
import { formatBRL } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'
import { GraficoMeses } from '../components/GraficoMeses'
import type { PontoMes } from '../components/GraficoMeses'

function lastNMonths(endYearMonth: string, n: number): string[] {
  const [y, m] = endYearMonth.split('-').map(Number)
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    let mo = m - i
    let yr = y
    while (mo < 1) { mo += 12; yr-- }
    months.push(`${yr}-${String(mo).padStart(2, '0')}`)
  }
  return months
}

function defaultMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function DashboardPage() {
  const [monthValue, setMonthValue] = useState(defaultMonth)
  const [error, setError] = useState<string | null>(null)
  const [pedidosMes, setPedidosMes] = useState<PedidoCliente[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [, setSaveMsg] = useState<string | null>(null)

  const [cfgDias, setCfgDias] = useState(22)

  const bounds = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthBoundsLocal(new Date().getFullYear(), new Date().getMonth() + 1)
    return monthBoundsLocal(y, m)
  }, [monthValue])

  async function reload() {
    setError(null)
    setSaveMsg(null)

    const [{ data: peds, error: e1 }, { data: maqs, error: e2 }] = await Promise.all([
      fetchPedidosPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end }),
      fetchMaquinas(),
    ])

    const { data: cfg, error: e3 } = await fetchAppConfig()

    if (e1) setError(e1)
    else if (e2) setError(e2)
    else if (e3) setError(e3)

    setPedidosMes(peds)
    setMaquinas(maqs)

    if (cfg) {
      setCfgDias(cfg.dias_uteis_mes_padrao)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue])

  const despesasQuery = async () =>
    fetchDespesasPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end })

  const [despesasValor, setDespesasValor] = useState(0)
  const [dadosGrafico, setDadosGrafico] = useState<PontoMes[]>([])
  
  const [receitaAno, setReceitaAno] = useState(0)
  const [despesasAno, setDespesasAno] = useState(0)

  useEffect(() => {
    ;(async () => {
      const { data } = await despesasQuery()
      setDespesasValor(somaDespesas(data))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start, bounds.end])

  useEffect(() => {
    ;(async () => {
      const meses = lastNMonths(monthValue, 6)
      const first = meses[0]
      const last = meses[meses.length - 1]
      const [fy, fm] = first.split('-').map(Number)
      const [ly, lm] = last.split('-').map(Number)
      const startDate = monthBoundsLocal(fy, fm).start
      const endDate = monthBoundsLocal(ly, lm).end

      const [{ data: peds }, { data: desps }] = await Promise.all([
        fetchPedidosPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate }),
        fetchDespesasPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate }),
      ])

      const pontos: PontoMes[] = meses.map((mes) => {
        const [my, mm] = mes.split('-').map(Number)
        const { start, end } = monthBoundsLocal(my, mm)
        const pedsMes = peds.filter(
          (p) => p.data_pedido >= start && p.data_pedido <= end && p.status !== 'cancelado',
        )
        const despsMes = desps.filter((d) => d.data >= start && d.data <= end)
        const receita = pedsMes.reduce((acc, p) => acc + receitaPedido(p), 0)
        const lucro = receita - somaDespesas(despsMes)
        return { mes, receita, lucro }
      })

      setDadosGrafico(pontos)
    })()
    
    ;(async () => {
      const y = monthValue.split('-')[0]
      const startDate = `${y}-01-01`
      const endDate = `${y}-12-31`
      const [{ data: peds }, { data: desps }] = await Promise.all([
        fetchPedidosPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate }),
        fetchDespesasPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate }),
      ])
      
      const pedsAtivos = peds.filter((p) => p.status !== 'cancelado')
      setReceitaAno(pedsAtivos.reduce((acc, p) => acc + receitaPedido(p), 0))
      setDespesasAno(somaDespesas(desps))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue])

  const { cap, receita, kgLavados, lucroMesSimples } = useMemo(() => {
    const ativosMes = pedidosMes.filter((p) => p.status !== 'cancelado')
    const receitaVal = ativosMes.reduce((acc, p) => acc + receitaPedido(p), 0)
    const kgVal = ativosMes.reduce((acc, p) => acc + Number(p.peso_kg ?? 0), 0)
    const capVals = capacidadeKgDia(maquinas)
    const luc = receitaVal - despesasValor
    return { cap: capVals, receita: receitaVal, kgLavados: kgVal, lucroMesSimples: luc }
  }, [pedidosMes, maquinas, despesasValor])

  const ocupacaoMes = useMemo(() => {
    const capKgMes = cap.gargaloKgDia * cfgDias
    if (capKgMes <= 0) return 0
    return kgLavados / capKgMes
  }, [cap.gargaloKgDia, cfgDias, kgLavados])

  return (
    <div className="grid" style={{ gap: 14 }}>
      <header className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Dashboard</h1>
          <div className="hint">
            Visão geral do mês: receita, lucro, ocupação das máquinas e cenário de capacidade máxima.
          </div>
        </div>
        <div className="field" style={{ minWidth: 220, flex: '0 0 auto' }}>
          <label htmlFor="mes">Referência</label>
          <input id="mes" type="month" value={monthValue} onChange={(e) => setMonthValue(e.target.value)} />
        </div>
      </header>

      {error ? (
        <StatusBanner kind="error" message={error} />
      ) : (
        <>
          <div className="grid gridCols2">
            <section className="panel">
              <div className="panelHeader">
                <h2 style={{ fontSize: 16 }}>Movimento</h2>
                <span className="hint" style={{ fontSize: 12 }}>{formatMesAno(monthValue)}</span>
              </div>
              <div className="panelBody grid" style={{ gap: 14 }}>
                <div>
                  <div className="statLabel">Receita do mês</div>
                  <div className="statVal">{formatBRL(receita)}</div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    {pedidosMes.filter((p) => p.status !== 'cancelado').length} pedidos ativos
                  </div>
                </div>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Kg lavados</div>
                    <div className="statValSm">
                      {(Math.round((kgLavados + Number.EPSILON) * 100) / 100).toLocaleString('pt-BR')} kg
                    </div>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Despesas lançadas</div>
                    <div className="statValSm">{formatBRL(despesasValor)}</div>
                  </div>
                </div>
                <div className="row" style={{ alignItems: 'flex-start', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Lucro líquido do mês</div>
                    <div
                      className={`statVal ${lucroMesSimples >= 0 ? 'valPositive' : 'valNegative'}`}
                    >
                      {formatBRL(lucroMesSimples)}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Total Entradas (Ano)</div>
                    <div className="statValSm valPositive">{formatBRL(receitaAno)}</div>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Total Gastos (Ano)</div>
                    <div className="statValSm valNegative">{formatBRL(despesasAno)}</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2 style={{ fontSize: 16 }}>Capacidade operacional</h2>
              </div>
              <div className="panelBody grid" style={{ gap: 14 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Lavagem (kg/dia)</div>
                    <div className="statValSm">
                      {(Math.round(cap.lavagemKgDia * 100) / 100).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Secagem (kg/dia)</div>
                    <div className="statValSm">
                      {(Math.round(cap.secagemKgDia * 100) / 100).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
                <div style={{ paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                  <div className="statLabel">Gargalo (kg/dia)</div>
                  <div className="statVal">
                    {(Math.round(cap.gargaloKgDia * 100) / 100).toLocaleString('pt-BR')}
                  </div>
                  <div className="hint" style={{ marginTop: 6 }}>
                    Ocupação estimada:{' '}
                    <strong>{(Math.round(ocupacaoMes * 1000) / 10).toLocaleString('pt-BR')}%</strong>
                    {' '}do máximo mensal ({cfgDias} dias úteis)
                  </div>
                  <div
                    className="progressWrap"
                    role="progressbar"
                    aria-valuenow={Math.round(ocupacaoMes * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`progressBar${ocupacaoMes > 0.85 ? ' progressBarWarn' : ''}`}
                      style={{ width: `${Math.min(ocupacaoMes * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panelHeader">
              <h2 style={{ fontSize: 16 }}>Receita e lucro — ultimos 6 meses</h2>
              <span className="hint" style={{ fontSize: 12 }}>passando o mouse sobre o grafico voce ve os valores</span>
            </div>
            <div className="panelBody">
              <GraficoMeses dados={dadosGrafico} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
