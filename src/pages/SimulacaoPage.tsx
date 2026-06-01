import { useMemo, useState } from 'react'
import { formatBRL } from '../lib/format'

function n(v: string) {
  return Math.max(0, Number(String(v).replace(',', '.')) || 0)
}

const DEFAULT_COMBUSTIVEL = (() => {
  // Unamar -> Arraial (~51 km) + volta (~51 km)
  const km = 51 * 2
  // GNV: cilindro de 16 m³, preço R$ 4,69 por m³, média 190 km por cilindro
  const cilindroM3 = 16
  const precoM3 = 4.69
  const autonomiaKm = 190
  const custoKm = (cilindroM3 * precoM3) / autonomiaKm
  return km * custoKm
})()

function Field({
  id,
  label,
  value,
  onChange,
  prefix,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  prefix?: string
  hint?: string
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        {prefix ? (
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted)',
              fontSize: 13,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {prefix}
          </span>
        ) : null}
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={prefix ? { paddingLeft: 28 } : undefined}
        />
      </div>
      {hint ? <div className="hint" style={{ marginTop: 4 }}>{hint}</div> : null}
    </div>
  )
}

export function SimulacaoPage() {
  const [msg, setMsg] = useState<string | null>(null)

  /* ── Produção ───────────────────────────────────────── */
  const defaults = (() => {
    try {
      const raw = localStorage.getItem('lav_simulacao_defaults')
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })()

  const [clientes, setClientes] = useState(defaults.clientes ?? '10')
  const [lavagens, setLavagens] = useState(defaults.lavagens ?? '4')
  const [pesoMedio, setPesoMedio] = useState(defaults.pesoMedio ?? '8')
  const [precoKg, setPrecoKg] = useState(defaults.precoKg ?? '20')

  /* ── Utilidades (por ciclo) ─────────────────────────── */
  const [litrosPorCiclo, setLitrosPorCiclo] = useState(defaults.litrosPorCiclo ?? '77,6')
  const [custoLuzPorCiclo, setCustoLuzPorCiclo] = useState(defaults.custoLuzPorCiclo ?? '0,36')
  const [tarifaAguaM3, setTarifaAguaM3] = useState(defaults.tarifaAguaM3 ?? '14,59')
  const [minAguaM3, setMinAguaM3] = useState(defaults.minAguaM3 ?? '10')

  /* ── Custos fixos ───────────────────────────────────── */
  const [aluguel, setAluguel] = useState(defaults.aluguel ?? '')
  const [carro, setCarro] = useState(defaults.carro ?? '1600')
  const [maquinas, setMaquinas] = useState(defaults.maquinas ?? '1000')
  const [contador, setContador] = useState(defaults.contador ?? '')
  const [outrosFixos, setOutrosFixos] = useState(defaults.outrosFixos ?? '')

  /* ── Custos variáveis ───────────────────────────────── */
  const [viagensArraial, setViagensArraial] = useState(defaults.viagensArraial ?? '1')
  const [combustivelExtra, setCombustivelExtra] = useState(defaults.combustivelExtra ?? '0')
  const [produtos, setProdutos] = useState(defaults.produtos ?? '')
  const [outrosVar, setOutrosVar] = useState(defaults.outrosVar ?? '')

  function salvarPadraoSimulacao() {
    setMsg(null)
    try {
      const payload: Record<string, string> = {
        clientes, lavagens, pesoMedio, precoKg,
        litrosPorCiclo, custoLuzPorCiclo, tarifaAguaM3, minAguaM3,
        aluguel, carro, maquinas, contador, outrosFixos,
        viagensArraial, combustivelExtra, produtos, outrosVar,
      }
      localStorage.setItem('lav_simulacao_defaults', JSON.stringify(payload))
      setMsg('Padrões salvos.')
    } catch {
      // sem banner específico aqui: usa o mesmo msg/erro do fluxo
      setMsg('Não foi possível salvar os padrões neste navegador.')
    }
  }

  /* ── Cálculos ───────────────────────────────────────── */
  const r = useMemo(() => {
    const totalKg = n(clientes) * n(lavagens) * n(pesoMedio)
    const receita = totalKg * n(precoKg)

    const ciclosMes = n(clientes) * n(lavagens)
    const aguaM3Calculado = (ciclosMes * n(litrosPorCiclo)) / 1000
    const aguaM3Faturado = aguaM3Calculado > 0 ? Math.max(n(minAguaM3), aguaM3Calculado) : 0
    const custoAgua = aguaM3Faturado * n(tarifaAguaM3)
    const custoLuz = ciclosMes * n(custoLuzPorCiclo)

    const custoViagensArraial = n(viagensArraial) * DEFAULT_COMBUSTIVEL

    const fixo =
      n(aluguel) + n(carro) + n(maquinas) + n(contador) + n(outrosFixos)
    const variavel = custoViagensArraial + n(combustivelExtra) + n(produtos) + n(outrosVar) + custoAgua + custoLuz
    const custoTotal = fixo + variavel
    const lucro = receita - custoTotal
    const margem = receita > 0 ? (lucro / receita) * 100 : 0
    const custoVarPorKg = totalKg > 0 ? variavel / totalKg : 0
    const margemContribuicao = n(precoKg) - custoVarPorKg
    const pontoEquilibrio =
      margemContribuicao > 0 ? fixo / margemContribuicao : null

    return {
      totalKg,
      ciclosMes,
      receita,
      fixo,
      variavel,
      custoViagensArraial,
      custoAgua,
      custoLuz,
      aguaM3Calculado,
      aguaM3Faturado,
      custoTotal,
      lucro,
      margem,
      custoVarPorKg,
      pontoEquilibrio,
    }
  }, [
    clientes, lavagens, pesoMedio, precoKg,
    litrosPorCiclo, custoLuzPorCiclo, tarifaAguaM3, minAguaM3,
    aluguel, carro, maquinas, contador, outrosFixos,
    viagensArraial, combustivelExtra, produtos, outrosVar,
  ])

  const lucroClass = r.lucro >= 0 ? 'valPositive' : 'valNegative'

  return (
    <div className="grid" style={{ gap: 14 }}>
      <header>
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Simulação de Ganhos</h1>
          <button className="btn btnPrimary" type="button" onClick={salvarPadraoSimulacao}>
            Salvar como padrão
          </button>
        </div>
        <div className="hint">
          Calcule receita, custos e lucro estimado sem salvar dados. Preencha os campos e os resultados atualizam em tempo real.
        </div>
        {msg ? <div className="hint" style={{ marginTop: 6 }}><strong>{msg}</strong></div> : null}
      </header>

      {/* ── Inputs ─────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {/* Produção */}
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Produção mensal</h2>
          </div>
          <div className="panelBody grid" style={{ gap: 10 }}>
            <Field
              id="clientes"
              label="Número de clientes"
              value={clientes}
              onChange={setClientes}
              hint="Clientes ativos no mês"
            />
            <Field
              id="lavagens"
              label="Lavagens por cliente / mês"
              value={lavagens}
              onChange={setLavagens}
              hint="Média de pedidos por cliente"
            />
            <Field
              id="peso"
              label="Peso médio por lavagem (kg)"
              value={pesoMedio}
              onChange={setPesoMedio}
            />
            <Field
              id="preco"
              label="Preço por kg (R$/kg)"
              value={precoKg}
              onChange={setPrecoKg}
              prefix="R$"
            />
            <div
              style={{
                paddingTop: 10,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span className="hint">Total kg / mês</span>
              <span style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 15 }}>
                {r.totalKg.toLocaleString('pt-BR')} kg
              </span>
            </div>
          </div>
        </section>

        {/* Custos fixos */}
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Custos fixos</h2>
            <span className="hint" style={{ fontSize: 12 }}>por mês</span>
          </div>
          <div className="panelBody grid" style={{ gap: 10 }}>
            <Field id="aluguel"   label="Aluguel"              value={aluguel}    onChange={setAluguel}    prefix="R$" />
            <Field id="carro"     label="Carro (parcela)"      value={carro}      onChange={setCarro}      prefix="R$" />
            <Field id="maquinas"  label="Máquinas (parcelas)"  value={maquinas}   onChange={setMaquinas}   prefix="R$" />
            <Field id="contador"  label="Contador"             value={contador}   onChange={setContador}   prefix="R$" />
            <Field id="outfixo"   label="Outros fixos"         value={outrosFixos} onChange={setOutrosFixos} prefix="R$" />
            <div
              style={{
                paddingTop: 10,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span className="hint">Total fixo</span>
              <span style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 15 }}>
                {formatBRL(r.fixo)}
              </span>
            </div>
          </div>
        </section>

        {/* Custos variáveis */}
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 15 }}>Custos variáveis</h2>
            <span className="hint" style={{ fontSize: 12 }}>por mês</span>
          </div>
          <div className="panelBody grid" style={{ gap: 10 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
                paddingBottom: 10,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <Field
                id="litrosCiclo"
                label="Água por ciclo (L)"
                value={litrosPorCiclo}
                onChange={setLitrosPorCiclo}
                hint="Ex.: 77,6 L por ciclo"
              />
              <Field
                id="luzCiclo"
                label="Luz por ciclo (R$)"
                value={custoLuzPorCiclo}
                onChange={setCustoLuzPorCiclo}
                prefix="R$"
                hint="Ex.: 0,36 por ciclo"
              />
              <Field
                id="tarifaAgua"
                label="Tarifa água (R$/m³)"
                value={tarifaAguaM3}
                onChange={setTarifaAguaM3}
                prefix="R$"
                hint="Tarifa da concessionária"
              />
              <Field
                id="minAgua"
                label="Mínimo faturado (m³)"
                value={minAguaM3}
                onChange={setMinAguaM3}
                hint="Regra: mínimo 10 m³"
              />
            </div>

            <div className="hint" style={{ marginTop: 2 }}>
              Ciclos/mês: <strong>{r.ciclosMes.toLocaleString('pt-BR')}</strong> · Água: {r.aguaM3Calculado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³ (calculado) →{' '}
              <strong>{r.aguaM3Faturado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³</strong> (faturado)
            </div>
            <div className="hint" style={{ marginTop: 2 }}>
              Luz (estimada): <strong>{formatBRL(r.custoLuz)}</strong> · Água (estimada): <strong>{formatBRL(r.custoAgua)}</strong>
            </div>

            <Field
              id="viagensArraial"
              label="Viagens Arraial (ida+volta) / mês"
              value={viagensArraial}
              onChange={setViagensArraial}
              hint={`102 km por viagem · custo estimado ${formatBRL(DEFAULT_COMBUSTIVEL)} por viagem`}
            />
            <div className="hint" style={{ marginTop: -2 }}>
              Combustível (viagens): <strong>{formatBRL(r.custoViagensArraial)}</strong>
            </div>
            <Field id="combExtra" label="Combustível extra" value={combustivelExtra} onChange={setCombustivelExtra} prefix="R$" />
            <Field id="produtos"    label="Produtos (químicos, etc.)" value={produtos}    onChange={setProdutos}    prefix="R$" />
            <Field id="outvar"      label="Outros variáveis" value={outrosVar}   onChange={setOutrosVar}   prefix="R$" />
            <div
              style={{
                paddingTop: 10,
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span className="hint">Total variável</span>
              <span style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 15 }}>
                {formatBRL(r.variavel)}
              </span>
            </div>
            {r.totalKg > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="hint">Custo variável/kg</span>
                <span className="hint" style={{ fontWeight: 600 }}>
                  {formatBRL(r.custoVarPorKg)}/kg
                </span>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {/* ── Resultados ─────────────────────────────────── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Resultado estimado</h2>
          <span className="hint" style={{ fontSize: 12 }}>atualizado automaticamente</span>
        </div>
        <div className="panelBody grid" style={{ gap: 16 }}>
          {/* KPIs principais */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 14,
            }}
          >
            <div>
              <div className="statLabel">Receita bruta</div>
              <div className="statValSm">{formatBRL(r.receita)}</div>
              <div className="hint" style={{ marginTop: 2 }}>{r.totalKg.toLocaleString('pt-BR')} kg × {formatBRL(n(precoKg))}/kg</div>
            </div>

            <div>
              <div className="statLabel">Custo total</div>
              <div className="statValSm">{formatBRL(r.custoTotal)}</div>
              <div className="hint" style={{ marginTop: 2 }}>fixo + variável</div>
            </div>

            <div style={{ paddingLeft: 14, borderLeft: '2px solid var(--border)' }}>
              <div className="statLabel">Lucro líquido</div>
              <div className={`statVal ${lucroClass}`}>{formatBRL(r.lucro)}</div>
              <div className="hint" style={{ marginTop: 2 }}>
                margem:{' '}
                <strong className={lucroClass}>
                  {r.margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </strong>
              </div>
            </div>
          </div>

          {/* Barra de composição do custo */}
          {r.receita > 0 ? (
            <div>
              <div className="hint" style={{ marginBottom: 6 }}>Composição da receita</div>
              <div
                style={{
                  height: 28,
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  border: '1px solid var(--border)',
                }}
              >
                {r.fixo > 0 ? (
                  <div
                    title={`Fixo: ${formatBRL(r.fixo)}`}
                    style={{
                      width: `${Math.min((r.fixo / r.receita) * 100, 100)}%`,
                      background: 'var(--warning)',
                      opacity: 0.75,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#fff',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      padding: '0 4px',
                    }}
                  >
                    {(r.fixo / r.receita * 100) > 8 ? 'Fixo' : ''}
                  </div>
                ) : null}
                {r.variavel > 0 ? (
                  <div
                    title={`Variável: ${formatBRL(r.variavel)}`}
                    style={{
                      width: `${Math.min((r.variavel / r.receita) * 100, 100)}%`,
                      background: 'var(--accent)',
                      opacity: 0.65,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#fff',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      padding: '0 4px',
                    }}
                  >
                    {(r.variavel / r.receita * 100) > 8 ? 'Variável' : ''}
                  </div>
                ) : null}
                {r.lucro > 0 ? (
                  <div
                    title={`Lucro: ${formatBRL(r.lucro)}`}
                    style={{
                      flex: 1,
                      background: 'var(--ok)',
                      opacity: 0.75,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#fff',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      padding: '0 4px',
                    }}
                  >
                    {(r.lucro / r.receita * 100) > 8 ? 'Lucro' : ''}
                  </div>
                ) : null}
                {r.lucro < 0 ? (
                  <div
                    style={{
                      width: `${Math.min((Math.abs(r.lucro) / r.receita) * 100, 100)}%`,
                      background: 'var(--danger)',
                      opacity: 0.7,
                    }}
                  />
                ) : null}
              </div>
              <div className="hint" style={{ marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--warning)', marginRight: 4, opacity: 0.75 }} />
                  Fixo {(r.fixo / r.receita * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--accent)', marginRight: 4, opacity: 0.65 }} />
                  Variável {(r.variavel / r.receita * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: r.lucro >= 0 ? 'var(--ok)' : 'var(--danger)', marginRight: 4, opacity: 0.75 }} />
                  {r.lucro >= 0 ? 'Lucro' : 'Prejuízo'} {Math.abs(r.margem).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                </span>
              </div>
            </div>
          ) : null}

          {/* Ponto de equilíbrio */}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="hint" style={{ marginBottom: 8 }}>Ponto de equilíbrio (break-even)</div>
            {r.pontoEquilibrio !== null ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 12,
                }}
              >
                <div>
                  <div className="statLabel">Kg mínimo / mês</div>
                  <div className="statValSm">
                    {Math.ceil(r.pontoEquilibrio).toLocaleString('pt-BR')} kg
                  </div>
                  <div className="hint" style={{ marginTop: 2 }}>para cobrir todos os custos</div>
                </div>
                <div>
                  <div className="statLabel">Receita mínima / mês</div>
                  <div className="statValSm">
                    {formatBRL(r.pontoEquilibrio * n(precoKg))}
                  </div>
                  <div className="hint" style={{ marginTop: 2 }}>faturamento de equilíbrio</div>
                </div>
                {r.totalKg > 0 ? (
                  <div>
                    <div className="statLabel">Você está</div>
                    <div
                      className={`statValSm ${r.totalKg >= r.pontoEquilibrio ? 'valPositive' : 'valNegative'}`}
                    >
                      {r.totalKg >= r.pontoEquilibrio
                        ? `+${(r.totalKg - r.pontoEquilibrio).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg acima`
                        : `${(r.pontoEquilibrio - r.totalKg).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg abaixo`}
                    </div>
                    <div className="hint" style={{ marginTop: 2 }}>do ponto de equilíbrio</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="hint">
                Preencha o preço/kg e custos variáveis para calcular o ponto de equilíbrio.
              </div>
            )}
          </div>

          {/* Tabela de detalhamento */}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="hint" style={{ marginBottom: 8 }}>Detalhamento</div>
            <div className="tableWrap">
              <table style={{ minWidth: 'unset' }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: 'right' }}>Valor / mês</th>
                    <th style={{ textAlign: 'right' }}>% da receita</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Receita bruta', val: r.receita, bold: true },
                    { label: '  Aluguel', val: -n(aluguel) },
                    { label: '  Carro', val: -n(carro) },
                    { label: '  Máquinas', val: -n(maquinas) },
                    { label: '  Contador', val: -n(contador) },
                    n(outrosFixos) ? { label: '  Outros fixos', val: -n(outrosFixos) } : null,
                      r.custoViagensArraial ? { label: '  Combustível (viagens Arraial)', val: -r.custoViagensArraial } : null,
                      n(combustivelExtra) ? { label: '  Combustível (extra)', val: -n(combustivelExtra) } : null,
                    { label: '  Produtos', val: -n(produtos) },
                    n(outrosVar) ? { label: '  Outros variáveis', val: -n(outrosVar) } : null,
                      r.custoLuz ? { label: '  Luz (por ciclo)', val: -r.custoLuz } : null,
                      r.custoAgua ? { label: '  Água (mín. 10 m³)', val: -r.custoAgua } : null,
                  ]
                    .filter(Boolean)
                    .map((row, i) => {
                      const item = row!
                      const pct = r.receita > 0 ? (Math.abs(item.val) / r.receita) * 100 : 0
                      return (
                        <tr key={i}>
                          <td style={(item as { bold?: boolean }).bold ? { fontWeight: 700, color: 'var(--text-h)' } : { paddingLeft: 20 }}>
                            {item.label.trim()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: (item as { bold?: boolean }).bold ? 700 : 400 }}>
                            <span className={item.val < 0 ? 'valNegative' : ''}>
                              {item.val < 0 ? `− ${formatBRL(Math.abs(item.val))}` : formatBRL(item.val)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }} className="hint">
                            {(item as { bold?: boolean }).bold ? '100%' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 800, color: 'var(--text-h)' }}>Lucro líquido</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      <span className={lucroClass}>{formatBRL(r.lucro)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }} className={lucroClass}>
                      {r.margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
