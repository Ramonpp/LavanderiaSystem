import { useEffect, useMemo, useState } from 'react'
import { fetchDespesasPorPeriodo } from '../data/despesas'
import { fetchPedidosPorPeriodo } from '../data/pedidos'
import { fetchConsumos, fetchConsumosAno } from '../data/consumo_maquina'
import { fetchMaquinas } from '../data/maquinas'


import { receitaPedido, somaDespesas } from '../domain/finance'
import type { PedidoCliente } from '../types/models'
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
  const [, setSaveMsg] = useState<string | null>(null)
  const [maquinas, setMaquinas] = useState<any[]>([])

  useEffect(() => {
    fetchMaquinas().then(({ data }) => {
      setMaquinas(data || [])
    })
  }, [])

  const bounds = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthBoundsLocal(new Date().getFullYear(), new Date().getMonth() + 1)
    return monthBoundsLocal(y, m)
  }, [monthValue])

  async function reload() {
    setError(null)
    setSaveMsg(null)

    const { data: peds, error: e1 } = await fetchPedidosPorPeriodo({ inicioIsoDate: bounds.start, fimIsoDate: bounds.end })

    if (e1) setError(e1)

    if (peds) setPedidosMes(peds)
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
  const [kgAno, setKgAno] = useState(0)
  
  const [consumoMesWh, setConsumoMesWh] = useState(0)
  const [consumoAnoWh, setConsumoAnoWh] = useState(0)

  useEffect(() => {
    ;(async () => {
      const { data } = await despesasQuery()
      const manualDesps = somaDespesas(data)
      
      setDespesasValor(manualDesps)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.start, bounds.end, maquinas])

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
        fetchDespesasPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate })
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
      const [{ data: peds }, { data: desps }, { data: consAno }] = await Promise.all([
        fetchPedidosPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate }),
        fetchDespesasPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate }),
        fetchConsumosAno(y)
      ])
      
      const pedsAtivos = peds.filter((p) => p.status !== 'cancelado')
      setReceitaAno(pedsAtivos.reduce((acc, p) => acc + receitaPedido(p), 0))
      setKgAno(pedsAtivos.reduce((acc, p) => acc + Number(p.peso_kg ?? 0), 0))

      setDespesasAno(somaDespesas(desps))
      
      const { data: consMes } = await fetchConsumos(monthValue)
      
      setConsumoAnoWh(consAno.reduce((acc, c) => acc + Number(c.consumo_wh), 0))
      setConsumoMesWh(consMes.reduce((acc, c) => acc + Number(c.consumo_wh), 0))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue, maquinas])

  const { receita, kgLavados, lucroMesSimples, pagamentos } = useMemo(() => {
    const ativosMes = pedidosMes.filter((p) => p.status !== 'cancelado')
    const receitaVal = ativosMes.reduce((acc, p) => acc + receitaPedido(p), 0)
    const kgVal = ativosMes.reduce((acc, p) => acc + Number(p.peso_kg ?? 0), 0)
    const luc = receitaVal - despesasValor
    
    let qtdPagos = 0
    let valPagos = 0
    let qtdDevendo = 0
    let valDevendo = 0

    for (const p of ativosMes) {
      const valor = receitaPedido(p)
      if (p.pagamento_status === 'pago') {
        qtdPagos++
        valPagos += valor
      } else {
        qtdDevendo++
        valDevendo += valor
      }
    }

    return { 
      receita: receitaVal, 
      kgLavados: kgVal, 
      lucroMesSimples: luc,
      pagamentos: { qtdPagos, valPagos, qtdDevendo, valDevendo }
    }
  }, [pedidosMes, despesasValor])

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
                  <div style={{ flex: '1 1 120px' }}>
                    <div className="statLabel">Total Gastos (Ano)</div>
                    <div className="statValSm valNegative">{formatBRL(despesasAno)}</div>
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <div className="statLabel">Kg Lavados (Ano)</div>
                    <div className="statValSm">{(Math.round((kgAno + Number.EPSILON) * 100) / 100).toLocaleString('pt-BR')} kg</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <h2 style={{ fontSize: 16 }}>Status de Pagamentos</h2>
                <span className="hint" style={{ fontSize: 12 }}>Valores baseados nos pedidos ativos do mês</span>
              </div>
              <div className="panelBody grid" style={{ gap: 14 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Pedidos Pagos</div>
                    <div className="statValSm valPositive">
                      {pagamentos.qtdPagos} ({formatBRL(pagamentos.valPagos)})
                    </div>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Pedidos Devendo</div>
                    <div className="statValSm valNegative">
                      {pagamentos.qtdDevendo} ({formatBRL(pagamentos.valDevendo)})
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="grid gridCols2">
            <section className="panel">
              <div className="panelHeader">
                <h2 style={{ fontSize: 16 }}>Consumo de Máquinas (Energia)</h2>
                <span className="hint" style={{ fontSize: 12 }}>Dados reais extraídos da LG ThinQ</span>
              </div>
              <div className="panelBody grid" style={{ gap: 14 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Consumo do Mês</div>
                    <div className="statValSm valNegative">
                      {(consumoMesWh / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh
                    </div>
                  </div>
                  <div style={{ flex: '1 1 160px' }}>
                    <div className="statLabel">Consumo do Ano</div>
                    <div className="statValSm valNegative">
                      {(consumoAnoWh / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh
                    </div>
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
