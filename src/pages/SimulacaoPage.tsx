import { useMemo, useState } from 'react'
import { formatBRL } from '../lib/format'

function n(v: string) {
  return Math.max(0, Number(String(v).replace(',', '.')) || 0)
}

function calcularCustoAgua(m3: number) {
  if (m3 <= 10) return 170.40;
  let custo = 170.40;
  if (m3 > 10) custo += Math.min(m3 - 10, 5) * 22.32;
  if (m3 > 15) custo += Math.min(m3 - 15, 10) * 35.74;
  if (m3 > 25) custo += Math.min(m3 - 25, 10) * 42.88;
  if (m3 > 35) custo += Math.min(m3 - 35, 10) * 51.46;
  if (m3 > 45) custo += Math.min(m3 - 45, 10) * 63.18;
  if (m3 > 55) custo += Math.min(m3 - 55, 10) * 80.25;
  if (m3 > 65) custo += (m3 - 65) * 91.26;
  return custo;
}

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
  const [kwPorCiclo, setKwPorCiclo] = useState(defaults.kwPorCiclo ?? '0,4')
  const [tarifaKw, setTarifaKw] = useState(defaults.tarifaKw ?? '0,90')

  /* ── Combustível ────────────────────────────────────── */
  const [combustivelTipo, setCombustivelTipo] = useState(defaults.combustivelTipo ?? 'gnv')
  const [combustivelPreco, setCombustivelPreco] = useState(defaults.combustivelPreco ?? '4,69')
  const [combustivelConsumo, setCombustivelConsumo] = useState(defaults.combustivelConsumo ?? '11,87')

  /* ── Custos fixos ───────────────────────────────────── */
  const [aluguel, setAluguel] = useState(defaults.aluguel ?? '')
  const [carro, setCarro] = useState(defaults.carro ?? '1600')
  const [maquinas, setMaquinas] = useState(defaults.maquinas ?? '1000')
  const [contador, setContador] = useState(defaults.contador ?? '')
  const [outrosFixos, setOutrosFixos] = useState(defaults.outrosFixos ?? '')

  /* ── Custos variáveis ───────────────────────────────── */
  const [viagensArraial, setViagensArraial] = useState(defaults.viagensArraial ?? '1')
  const [produtos, setProdutos] = useState(defaults.produtos ?? '')
  const [outrosVar, setOutrosVar] = useState(defaults.outrosVar ?? '')

  /* ── Comparativo Combustíveis (apenas UI) ───────────── */
  const [compGnvPreco, setCompGnvPreco] = useState(defaults.compGnvPreco ?? '4,69')
  const [compGnvConsumo, setCompGnvConsumo] = useState(defaults.compGnvConsumo ?? '11,87')
  const [compEtanolPreco, setCompEtanolPreco] = useState(defaults.compEtanolPreco ?? '3,99')
  const [compEtanolConsumo, setCompEtanolConsumo] = useState(defaults.compEtanolConsumo ?? '8,5')
  const [compGasolinaPreco, setCompGasolinaPreco] = useState(defaults.compGasolinaPreco ?? '5,99')
  const [compGasolinaConsumo, setCompGasolinaConsumo] = useState(defaults.compGasolinaConsumo ?? '12,0')

  function salvarPadraoSimulacao() {
    setMsg(null)
    try {
      const payload: Record<string, string> = {
        clientes, lavagens, pesoMedio, precoKg,
        litrosPorCiclo, kwPorCiclo, tarifaKw,
        combustivelTipo, combustivelPreco, combustivelConsumo,
        aluguel, carro, maquinas, contador, outrosFixos,
        viagensArraial, produtos, outrosVar,
        compGnvPreco, compGnvConsumo, compEtanolPreco, compEtanolConsumo, compGasolinaPreco, compGasolinaConsumo,
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
    const aguaM3Faturado = aguaM3Calculado > 0 ? Math.max(10, aguaM3Calculado) : 0
    const custoAgua = ciclosMes > 0 ? calcularCustoAgua(aguaM3Faturado) : 0
    const custoLuz = ciclosMes * (n(kwPorCiclo) * n(tarifaKw))

    const custoViagem = n(combustivelConsumo) > 0 ? (110 / n(combustivelConsumo)) * n(combustivelPreco) : 0
    const custoViagensArraial = n(viagensArraial) * custoViagem

    const custoCompGnv = n(compGnvConsumo) > 0 ? (110 / n(compGnvConsumo)) * n(compGnvPreco) : 0
    const custoCompEtanol = n(compEtanolConsumo) > 0 ? (110 / n(compEtanolConsumo)) * n(compEtanolPreco) : 0
    const custoCompGasolina = n(compGasolinaConsumo) > 0 ? (110 / n(compGasolinaConsumo)) * n(compGasolinaPreco) : 0

    const tanquesGnv = n(compGnvConsumo) > 0 ? ((n(viagensArraial) * 110) / n(compGnvConsumo)) / 13 : 0
    const tanquesEtanol = n(compEtanolConsumo) > 0 ? ((n(viagensArraial) * 110) / n(compEtanolConsumo)) / 58 : 0
    const tanquesGasolina = n(compGasolinaConsumo) > 0 ? ((n(viagensArraial) * 110) / n(compGasolinaConsumo)) / 58 : 0

    const fixo =
      n(aluguel) + n(carro) + n(maquinas) + n(contador) + n(outrosFixos)
    const variavel = custoViagensArraial + n(produtos) + n(outrosVar) + custoAgua + custoLuz
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
      custoCompGnv,
      custoCompEtanol,
      custoCompGasolina,
      tanquesGnv,
      tanquesEtanol,
      tanquesGasolina,
    }
  }, [
    clientes, lavagens, pesoMedio, precoKg,
    litrosPorCiclo, kwPorCiclo, tarifaKw,
    combustivelTipo, combustivelPreco, combustivelConsumo,
    aluguel, carro, maquinas, contador, outrosFixos,
    viagensArraial, produtos, outrosVar,
    compGnvPreco, compGnvConsumo, compEtanolPreco, compEtanolConsumo, compGasolinaPreco, compGasolinaConsumo,
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                id="kwCiclo"
                label="KW por ciclo"
                value={kwPorCiclo}
                onChange={setKwPorCiclo}
                hint="Ex.: 0,4 KW"
              />
              <Field
                id="tarifaKw"
                label="Tarifa de Luz (R$/KW)"
                value={tarifaKw}
                onChange={setTarifaKw}
                prefix="R$"
                hint="Valor do KW"
              />
              <div className="hint" style={{ gridColumn: '1 / -1', marginTop: -2, paddingBottom: 6 }}>
                Água calculada progressivamente baseada na tarifa referencial (mínimo 10m³ = R$ 170,04). Lembrete: 1000L = 1m³.
              </div>
            </div>

            <div className="hint" style={{ marginTop: 2 }}>
              Ciclos/mês: <strong>{r.ciclosMes.toLocaleString('pt-BR')}</strong> · Água: {r.aguaM3Calculado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³ (calculado) →{' '}
              <strong>{r.aguaM3Faturado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³</strong> (faturado)
            </div>
            <div className="hint" style={{ marginTop: 2 }}>
              Luz (estimada): <strong>{formatBRL(r.custoLuz)}</strong> · Água (estimada): <strong>{formatBRL(r.custoAgua)}</strong>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
                marginTop: 6,
              }}
            >
              <div className="field">
                <label>Combustível</label>
                <select value={combustivelTipo} onChange={(e) => setCombustivelTipo(e.target.value)}>
                  <option value="gnv">GNV</option>
                  <option value="etanol">Etanol</option>
                  <option value="gasolina">Gasolina</option>
                </select>
              </div>
              <Field
                id="combPreco"
                label={`Preço ${combustivelTipo === 'gnv' ? 'm³' : 'Litro'}`}
                value={combustivelPreco}
                onChange={setCombustivelPreco}
                prefix="R$"
              />
              <Field
                id="combConsumo"
                label={`Km por ${combustivelTipo === 'gnv' ? 'm³' : 'Litro'}`}
                value={combustivelConsumo}
                onChange={setCombustivelConsumo}
                hint="Consumo médio"
              />
            </div>
            <Field
              id="viagensArraial"
              label="Viagens Arraial (ida+volta) / mês"
              value={viagensArraial}
              onChange={setViagensArraial}
              hint={`110 km por viagem · custo ${n(combustivelConsumo) > 0 ? formatBRL((110 / n(combustivelConsumo)) * n(combustivelPreco)) : 'R$ 0,00'} por viagem`}
            />
            <div className="hint" style={{ marginTop: -2, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
              Combustível (viagens): <strong>{formatBRL(r.custoViagensArraial)}</strong>
            </div>
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
                    ...(() => {
                      if (!n(viagensArraial)) return []
                      const rows = []
                      if (combustivelTipo === 'gnv') {
                        rows.push({ label: '  Combustível (GNV)', val: -(r.custoCompGnv * n(viagensArraial)) })
                        rows.push({ label: '• Comparativo Etanol', val: -(r.custoCompEtanol * n(viagensArraial)), infoOnly: true, isSub: true })
                        rows.push({ label: '• Comparativo Gasolina', val: -(r.custoCompGasolina * n(viagensArraial)), infoOnly: true, isSub: true })
                      } else if (combustivelTipo === 'etanol') {
                        rows.push({ label: '  Combustível (Etanol)', val: -(r.custoCompEtanol * n(viagensArraial)) })
                        rows.push({ label: '• Comparativo GNV', val: -(r.custoCompGnv * n(viagensArraial)), infoOnly: true, isSub: true })
                        rows.push({ label: '• Comparativo Gasolina', val: -(r.custoCompGasolina * n(viagensArraial)), infoOnly: true, isSub: true })
                      } else {
                        rows.push({ label: '  Combustível (Gasolina)', val: -(r.custoCompGasolina * n(viagensArraial)) })
                        rows.push({ label: '• Comparativo GNV', val: -(r.custoCompGnv * n(viagensArraial)), infoOnly: true, isSub: true })
                        rows.push({ label: '• Comparativo Etanol', val: -(r.custoCompEtanol * n(viagensArraial)), infoOnly: true, isSub: true })
                      }
                      return rows
                    })(),
                    { label: '  Produtos', val: -n(produtos) },
                    n(outrosVar) ? { label: '  Outros variáveis', val: -n(outrosVar) } : null,
                      r.custoLuz ? { label: '  Luz (por ciclo)', val: -r.custoLuz } : null,
                      r.custoAgua ? { label: '  Água (mín. 10 m³)', val: -r.custoAgua } : null,
                  ]
                    .filter(Boolean)
                    .map((row, i) => {
                      const item = row!
                      const isInfo = (item as any).infoOnly
                      const pct = r.receita > 0 ? (Math.abs(item.val) / r.receita) * 100 : 0
                      return (
                        <tr key={i} style={isInfo ? { opacity: 0.55 } : {}}>
                          <td style={(item as { bold?: boolean }).bold ? { fontWeight: 700, color: 'var(--text-h)' } : { paddingLeft: (item as any).isSub ? 38 : 20, fontSize: (item as any).isSub ? 13 : undefined }}>
                            {item.label.trim()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: (item as { bold?: boolean }).bold ? 700 : 400 }}>
                            <span className={item.val < 0 && !isInfo ? 'valNegative' : ''}>
                              {item.val < 0 ? `− ${formatBRL(Math.abs(item.val))}` : formatBRL(item.val)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }} className="hint">
                            {isInfo ? '—' : ((item as { bold?: boolean }).bold ? '100%' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)}
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

      {/* ── Comparativo de Combustíveis ──────────────────── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 15 }}>Comparativo de Combustíveis (Viagem 110 km)</h2>
          <span className="hint" style={{ fontSize: 12 }}>Descubra qual vale mais a pena</span>
        </div>
        <div className="panelBody">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* GNV */}
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-h)' }}>GNV</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Field id="compGnvPreco" label="Preço (R$/m³)" value={compGnvPreco} onChange={setCompGnvPreco} prefix="R$" />
                <Field id="compGnvConsumo" label="Média (km/m³)" value={compGnvConsumo} onChange={setCompGnvConsumo} />
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                  <div className="statLabel">Custo por Viagem</div>
                  <div className="statValSm" style={{ color: r.custoCompGnv <= Math.min(r.custoCompGnv, r.custoCompEtanol, r.custoCompGasolina) ? 'var(--ok)' : 'inherit' }}>
                    {formatBRL(r.custoCompGnv)}
                  </div>
                  <div className="hint" style={{ marginTop: 2, fontSize: 11 }}>
                    {r.tanquesGnv.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tanques/mês (13m³)
                  </div>
                </div>
              </div>
            </div>

            {/* Etanol */}
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-h)' }}>Etanol</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Field id="compEtaPreco" label="Preço (R$/L)" value={compEtanolPreco} onChange={setCompEtanolPreco} prefix="R$" />
                <Field id="compEtaConsumo" label="Média (km/L)" value={compEtanolConsumo} onChange={setCompEtanolConsumo} />
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                  <div className="statLabel">Custo por Viagem</div>
                  <div className="statValSm" style={{ color: r.custoCompEtanol <= Math.min(r.custoCompGnv, r.custoCompEtanol, r.custoCompGasolina) ? 'var(--ok)' : 'inherit' }}>
                    {formatBRL(r.custoCompEtanol)}
                  </div>
                  <div className="hint" style={{ marginTop: 2, fontSize: 11 }}>
                    {r.tanquesEtanol.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tanques/mês (58L)
                  </div>
                </div>
              </div>
            </div>

            {/* Gasolina */}
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-h)' }}>Gasolina</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Field id="compGasPreco" label="Preço (R$/L)" value={compGasolinaPreco} onChange={setCompGasolinaPreco} prefix="R$" />
                <Field id="compGasConsumo" label="Média (km/L)" value={compGasolinaConsumo} onChange={setCompGasolinaConsumo} />
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
                  <div className="statLabel">Custo por Viagem</div>
                  <div className="statValSm" style={{ color: r.custoCompGasolina <= Math.min(r.custoCompGnv, r.custoCompEtanol, r.custoCompGasolina) ? 'var(--ok)' : 'inherit' }}>
                    {formatBRL(r.custoCompGasolina)}
                  </div>
                  <div className="hint" style={{ marginTop: 2, fontSize: 11 }}>
                    {r.tanquesGasolina.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tanques/mês (58L)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
