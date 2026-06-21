import { useEffect, useMemo, useState } from 'react'
import { fetchDespesasPorPeriodo } from '../data/despesas'
import { fetchPedidosPorPeriodo } from '../data/pedidos'
import { fetchMaquinas } from '../data/maquinas'
import { fetchResumosMensais } from '../data/resumo_mensal'
import type { ResumoMensal } from '../types/models'


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

function lsGet(key: string, fallback: string) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
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
  
  const [consumoMesValor, setConsumoMesValor] = useState(0)
  const [consumoAnoValor, setConsumoAnoValor] = useState(0)
  const [resumosMensais, setResumosMensais] = useState<ResumoMensal[]>([])
  
  const [custoEnergiaMes, setCustoEnergiaMes] = useState(0)
  const [custoAguaMes, setCustoAguaMes] = useState(0)
  const [kwhMaq753, setKwhMaq753] = useState(0)
  const [kwhMaq789, setKwhMaq789] = useState(0)

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
      const [{ data: peds }, { data: desps }] = await Promise.all([
        fetchPedidosPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate }),
        fetchDespesasPorPeriodo({ inicioIsoDate: startDate, fimIsoDate: endDate })
      ])
      
      const pedsAtivos = peds.filter((p) => p.status !== 'cancelado')
      setReceitaAno(pedsAtivos.reduce((acc, p) => acc + receitaPedido(p), 0))
      setKgAno(pedsAtivos.reduce((acc, p) => acc + Number(p.peso_kg ?? 0), 0))

      setDespesasAno(somaDespesas(desps))
      
      const tarifaKwh = Math.max(0, Number(lsGet('lav_custos_tarifaKwh', '0.85').replace(',', '.')) || 0)

      function calcularCustoAguaDemaisCidades(vM3: number): number {
        if (vM3 <= 0) return 0
        if (vM3 <= 10) return 170.40
        if (vM3 <= 15) return vM3 * 22.32
        if (vM3 <= 25) return vM3 * 35.74
        if (vM3 <= 35) return vM3 * 42.88
        if (vM3 <= 45) return vM3 * 51.46
        if (vM3 <= 55) return vM3 * 63.18
        if (vM3 <= 65) return vM3 * 80.25
        return vM3 * 91.26
      }

      // Mês atual selecionado
      let totalKwhMes = 0
      let totalLitrosMes = 0
      let k1 = 0
      let k2 = 0

      for (const maq of ['maq_753', 'maq_789']) {
        const litros = Math.max(0, Number(lsGet(`lav_${maq}_litros`, '80').replace(',', '.')) || 0)
        const whMesStr = lsGet(`lav_${maq}_wh_${monthValue}`, '')
        const ciclosMesStr = lsGet(`lav_${maq}_ciclos_${monthValue}`, '')
        
        let kwhTotal = 0
        if (whMesStr !== '') {
          kwhTotal = Number(whMesStr) / 1000
          totalKwhMes += kwhTotal
        }
        if (maq === 'maq_753') k1 = kwhTotal
        else k2 = kwhTotal

        if (ciclosMesStr !== '') {
          const ciclos = Math.max(0, Number(ciclosMesStr) || 0)
          totalLitrosMes += litros * ciclos
        }
      }

      const cEnergiaMes = totalKwhMes * tarifaKwh
      const cAguaMes = calcularCustoAguaDemaisCidades(totalLitrosMes / 1000)
      const custoMes = cEnergiaMes + cAguaMes

      setKwhMaq753(k1)
      setKwhMaq789(k2)
      setCustoEnergiaMes(cEnergiaMes)
      setCustoAguaMes(cAguaMes)
      setConsumoMesValor(custoMes)

      // Ano todo
      const year = monthValue.split('-')[0]
      let custoAno = 0
      for (let m = 1; m <= 12; m++) {
        const mesAno = `${year}-${String(m).padStart(2, '0')}`
        let totalKwhAnoMes = 0
        let totalLitrosAnoMes = 0

        for (const maq of ['maq_753', 'maq_789']) {
          const litros = Math.max(0, Number(lsGet(`lav_${maq}_litros`, '80').replace(',', '.')) || 0)
          const whAnoStr = lsGet(`lav_${maq}_wh_${mesAno}`, '')
          const ciclosAnoStr = lsGet(`lav_${maq}_ciclos_${mesAno}`, '')

          if (whAnoStr !== '') {
            totalKwhAnoMes += Number(whAnoStr) / 1000
          }
          if (ciclosAnoStr !== '') {
            const ciclos = Math.max(0, Number(ciclosAnoStr) || 0)
            totalLitrosAnoMes += litros * ciclos
          }
        }

        const custoEnergiaAnoMes = totalKwhAnoMes * tarifaKwh
        const custoAguaAnoMes = calcularCustoAguaDemaisCidades(totalLitrosAnoMes / 1000)
        custoAno += (custoEnergiaAnoMes + custoAguaAnoMes)
      }
      
      setConsumoAnoValor(custoAno)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue, maquinas])

  useEffect(() => {
    fetchResumosMensais(12).then(({ data }) => setResumosMensais(data))
  }, [])

  const { receita, kgLavados, lucroMesSimples, pagamentos, statusPedidos } = useMemo(() => {
    const ativosMes = pedidosMes.filter((p) => p.status !== 'cancelado')
    const receitaVal = ativosMes.reduce((acc, p) => acc + receitaPedido(p), 0)
    const kgVal = ativosMes.reduce((acc, p) => acc + Number(p.peso_kg ?? 0), 0)
    // O lucro aqui deduz as despesas + custo das máquinas local
    const luc = receitaVal - despesasValor - consumoMesValor
    
    let qtdPagos = 0
    let valPagos = 0
    let qtdDevendo = 0
    let valDevendo = 0

    let qtdRecebido = 0
    let qtdLavagem = 0
    let qtdPronto = 0
    let qtdEntregue = 0

    for (const p of ativosMes) {
      const valor = receitaPedido(p)
      if (p.pagamento_status === 'pago') {
        qtdPagos++
        valPagos += valor
      } else {
        qtdDevendo++
        valDevendo += valor
      }

      if (p.status === 'recebido') qtdRecebido++
      if (p.status === 'em_lavagem') qtdLavagem++
      if (p.status === 'pronto') qtdPronto++
      if (p.status === 'entregue') qtdEntregue++
    }

    return { 
      receita: receitaVal, 
      kgLavados: kgVal, 
      lucroMesSimples: luc,
      pagamentos: { qtdPagos, valPagos, qtdDevendo, valDevendo },
      statusPedidos: { recebido: qtdRecebido, lavagem: qtdLavagem, pronto: qtdPronto, entregue: qtdEntregue }
    }
  }, [pedidosMes, despesasValor, consumoMesValor])

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

            <div className="grid">
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

              <section className="panel">
                <div className="panelHeader">
                  <h2 style={{ fontSize: 16 }}>Status dos Pedidos</h2>
                  <span className="hint" style={{ fontSize: 12 }}>Quantidade por etapa no mês</span>
                </div>
                <div className="panelBody grid" style={{ gap: 14 }}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ flex: '1 1 80px' }}>
                      <div className="statLabel">Recebidos</div>
                      <div className="statValSm">{statusPedidos.recebido}</div>
                    </div>
                    <div style={{ flex: '1 1 80px' }}>
                      <div className="statLabel">Em Lavagem</div>
                      <div className="statValSm">{statusPedidos.lavagem}</div>
                    </div>
                    <div style={{ flex: '1 1 80px' }}>
                      <div className="statLabel">Prontos</div>
                      <div className="statValSm" style={{ color: 'var(--accent)' }}>{statusPedidos.pronto}</div>
                    </div>
                    <div style={{ flex: '1 1 80px' }}>
                      <div className="statLabel">Entregues</div>
                      <div className="statValSm" style={{ color: 'var(--ok)' }}>{statusPedidos.entregue}</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="panel">
            <div className="panelHeader">
              <h2 style={{ fontSize: 16 }}>Custos de utilidades do mês</h2>
              <span className="hint" style={{ fontSize: 12 }}>Energia + Água (Sincronizado com o menu de Custos)</span>
            </div>
            <div className="panelBody grid" style={{ gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
                <div>
                  <div className="statLabel">Custo total / mês</div>
                  <div className="statVal" style={{ color: 'var(--accent)' }}>{formatBRL(consumoMesValor)}</div>
                  <div className="hint" style={{ marginTop: 4 }}>
                    Ano todo: {formatBRL(consumoAnoValor)}
                  </div>
                </div>
                <div>
                  <div className="statLabel">Energia (Luz)</div>
                  <div className="statValSm" style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatBRL(custoEnergiaMes)}</div>
                  <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                    {lsGet('lav_maq_753_apelido', '') || 'Lavadora 753'}: {kwhMaq753.toFixed(2)} kWh<br />
                    {lsGet('lav_maq_789_apelido', '') || 'Lavadora 789'}: {kwhMaq789.toFixed(2)} kWh
                  </div>
                </div>
                <div>
                  <div className="statLabel">Água</div>
                  <div className="statValSm" style={{ color: 'var(--ok)', fontWeight: 700 }}>{formatBRL(custoAguaMes)}</div>
                  <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>
                    Baseado na tabela de faixas Prolagos (Demais Cidades)
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <h2 style={{ fontSize: 16 }}>Receita e lucro — últimos 6 meses</h2>
              <span className="hint" style={{ fontSize: 12 }}>Passe o mouse sobre o gráfico para ver os valores</span>
            </div>
            <div className="panelBody">
              <GraficoMeses dados={dadosGrafico} />
            </div>
          </section>

          {resumosMensais.length > 0 && (
            <section className="panel">
              <div className="panelHeader">
                <h2 style={{ fontSize: 16 }}>Histórico mensal — Energia &amp; Água</h2>
                <span className="hint" style={{ fontSize: 12 }}>Salvo via menu Custos · últimos 12 meses</span>
              </div>
              <div className="panelBody">
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th style={{ textAlign: 'right' }}>Pedidos</th>
                        <th style={{ textAlign: 'right' }}>Kg lavados</th>
                        <th style={{ textAlign: 'right' }}>Luz (R$)</th>
                        <th style={{ textAlign: 'right' }}>Água (R$)</th>
                        <th style={{ textAlign: 'right' }}>Total utilid.</th>
                        <th style={{ textAlign: 'right' }}>R$/kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumosMensais.map((r) => {
                        const totalUtil = r.custo_energia + r.custo_agua
                        const custoPorKg = r.total_kg > 0 ? totalUtil / r.total_kg : 0
                        return (
                          <tr key={r.mes_ano}>
                            <td style={{ fontWeight: 600 }}>{formatMesAno(r.mes_ano)}</td>
                            <td style={{ textAlign: 'right' }}>{r.total_pedidos}</td>
                            <td style={{ textAlign: 'right' }}>
                              {Number(r.total_kg).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{formatBRL(r.custo_energia)}</td>
                            <td style={{ textAlign: 'right', color: 'var(--ok)' }}>{formatBRL(r.custo_agua)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatBRL(totalUtil)}</td>
                            <td style={{ textAlign: 'right' }}>{custoPorKg > 0 ? formatBRL(custoPorKg) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {resumosMensais.length > 1 && (() => {
                      const totPedidos = resumosMensais.reduce((a, r) => a + r.total_pedidos, 0)
                      const totKg = resumosMensais.reduce((a, r) => a + Number(r.total_kg), 0)
                      const totEnergia = resumosMensais.reduce((a, r) => a + r.custo_energia, 0)
                      const totAgua = resumosMensais.reduce((a, r) => a + r.custo_agua, 0)
                      const totUtil = totEnergia + totAgua
                      const mediaCustoPorKg = totKg > 0 ? totUtil / totKg : 0
                      return (
                        <tfoot>
                          <tr style={{ fontWeight: 700 }}>
                            <td>Total ({resumosMensais.length} meses)</td>
                            <td style={{ textAlign: 'right' }}>{totPedidos}</td>
                            <td style={{ textAlign: 'right' }}>
                              {totKg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{formatBRL(totEnergia)}</td>
                            <td style={{ textAlign: 'right', color: 'var(--ok)' }}>{formatBRL(totAgua)}</td>
                            <td style={{ textAlign: 'right' }}>{formatBRL(totUtil)}</td>
                            <td style={{ textAlign: 'right' }}>{mediaCustoPorKg > 0 ? formatBRL(mediaCustoPorKg) : '—'}</td>
                          </tr>
                        </tfoot>
                      )
                    })()}
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

