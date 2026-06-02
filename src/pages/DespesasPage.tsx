import { useEffect, useMemo, useState } from 'react'
import { deleteDespesa, fetchDespesasPorPeriodo, insertDespesasLote } from '../data/despesas'
import type { Despesa } from '../types/models'
import { formatMesAno, monthBoundsLocal } from '../lib/dates'
import { formatBRL } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'

/* ── Helpers ────────────────────────────────────────────── */
function monthDefault(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function n(v: string) {
  return Math.max(0, Number(String(v).replace(',', '.')) || 0)
}

function addMonths(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  return `${yr}-${mo}`
}

function mesAnoToIsoDay1(yearMonth: string): string {
  return `${yearMonth}-01`
}

/* ── Componente ─────────────────────────────────────────── */
export function DespesasPage() {
  /* Filtro de mês */
  const [monthValue, setMonthValue] = useState(monthDefault)
  const [lista, setLista] = useState<Despesa[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  /* Campos do formulário */
  const [parcelado, setParcelado] = useState(false)

  /* Não-parcelado */
  const [dataLanc, setDataLanc] = useState(() => new Date().toISOString().slice(0, 10))
  const [quantidade, setQuantidade] = useState('1')
  const [valorUnit, setValorUnit] = useState('')

  /* Parcelado */
  const [mesInicio, setMesInicio] = useState(monthDefault)
  const [numParcelas, setNumParcelas] = useState('12')
  const [valorParcela, setValorParcela] = useState('')

  /* Comuns */
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')

  /* ── Bounds e queries ──────────────────────────────────── */
  const bounds = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number)
    if (!Number.isFinite(y) || !Number.isFinite(m))
      return monthBoundsLocal(new Date().getFullYear(), new Date().getMonth() + 1)
    return monthBoundsLocal(y, m)
  }, [monthValue])

  async function recarregar() {
    setErro(null)
    const { data, error } = await fetchDespesasPorPeriodo({
      inicioIsoDate: bounds.start,
      fimIsoDate: bounds.end,
    })
    if (error) setErro(error)
    setLista(data)
  }

  useEffect(() => {
    void recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue])

  const total = useMemo(() => lista.reduce((a, d) => a + Number(d.valor ?? 0), 0), [lista])

  /* ── Valores calculados em tempo real ──────────────────── */
  const totalNormal = n(quantidade) * n(valorUnit)

  const parcelasNum = Math.max(1, Math.round(n(numParcelas)))
  const totalParcelado = parcelasNum * n(valorParcela)

  const mesTermino = parcelado ? addMonths(mesInicio, parcelasNum - 1) : ''

  /* ── Preview de parcelas ───────────────────────────────── */
  const previewParcelas = useMemo(() => {
    if (!parcelado || parcelasNum <= 0) return []
    return Array.from({ length: Math.min(parcelasNum, 3) }, (_, i) => ({
      mes: addMonths(mesInicio, i),
      num: i + 1,
    }))
  }, [parcelado, mesInicio, parcelasNum])

  /* ── Salvar ────────────────────────────────────────────── */
  async function salvar() {
    setErro(null)
    setMsg(null)

    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }

    if (!parcelado) {
      /* Lançamento simples */
      if (!dataLanc) { setErro('Data inválida.'); return }
      const total = n(quantidade) * n(valorUnit)
      if (total <= 0) { setErro('Valor total deve ser maior que zero.'); return }

      const qtd = n(quantidade)
      const descFinal =
        qtd > 1
          ? `${qtd}× ${descricao.trim() || nome}`.trim()
          : descricao.trim() || null

      const { error } = await insertDespesasLote([{
        data: dataLanc,
        categoria: nome.trim(),
        descricao: descFinal,
        valor: total,
      }])
      if (error) { setErro(error); return }

      setMsg('Despesa lançada.')
      setValorUnit('')
      setDescricao('')
      setQuantidade('1')
      setNome('')
    } else {
      /* Parcelado — cria N registros */
      if (!mesInicio) { setErro('Mês de início inválido.'); return }
      const vp = n(valorParcela)
      if (vp <= 0) { setErro('Valor da parcela deve ser maior que zero.'); return }
      if (parcelasNum < 1) { setErro('Número de parcelas inválido.'); return }

      const registros: Omit<Despesa, 'id' | 'criado_em'>[] = Array.from(
        { length: parcelasNum },
        (_, i) => ({
          data: mesAnoToIsoDay1(addMonths(mesInicio, i)),
          categoria: nome.trim(),
          descricao: `${descricao.trim() ? descricao.trim() + ' — ' : ''}Parcela ${i + 1}/${parcelasNum}`,
          valor: vp,
        }),
      )

      const { error } = await insertDespesasLote(registros)
      if (error) { setErro(error); return }

      setMsg(`${parcelasNum} parcela(s) lançada(s) — ${formatMesAno(mesInicio)} até ${formatMesAno(mesTermino)}.`)
      setValorParcela('')
      setDescricao('')
      setNumParcelas('12')
      setNome('')
    }

    await recarregar()
  }

  async function remover(d: Despesa) {
    if (!window.confirm('Remover este lançamento definitivamente?')) return
    setErro(null)
    const { error } = await deleteDespesa(d.id)
    if (error) setErro(error)
    else await recarregar()
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="grid" style={{ gap: 12 }}>
      <header className="row" style={{ alignItems: 'end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Despesas</h1>
          <div className="hint">
            Registre despesas por categoria para calcular o lucro líquido no dashboard e nos relatórios.
          </div>
        </div>
        <div className="field" style={{ minWidth: 200, flex: '0 0 auto' }}>
          <label htmlFor="mes">Mês exibido</label>
          <input
            id="mes"
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
          />
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      {/* ── Formulário ────────────────────────────────────── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Novo lançamento</h2>

          {/* Toggle parcelado */}
          <div className="field">
            <label>É parcelado?</label>
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setParcelado(false)}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: !parcelado ? 'var(--panel)' : 'transparent',
                  color: !parcelado ? 'var(--text-h)' : 'var(--muted)',
                  boxShadow: !parcelado ? 'var(--shadow)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => setParcelado(true)}
                style={{
                  flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: parcelado ? 'var(--panel)' : 'transparent',
                  color: parcelado ? 'var(--text-h)' : 'var(--muted)',
                  boxShadow: parcelado ? 'var(--shadow)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                Sim
              </button>
            </div>
          </div>
        </div>

        <div className="panelBody grid" style={{ gap: 12 }}>
          {/* Linha 1 — Nome + Data/Mês */}
          <div className="row">
            <div className="field" style={{ flex: '2 1 220px' }}>
              <label htmlFor="nomeDespesa">Nome</label>
              <input
                id="nomeDespesa"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="ex: Aluguel, Energia, Produto X"
              />
            </div>

            {!parcelado ? (
              <div className="field" style={{ flex: '1 1 160px' }}>
                <label htmlFor="dataLanc">Data</label>
                <input
                  id="dataLanc"
                  type="date"
                  value={dataLanc}
                  onChange={(e) => setDataLanc(e.target.value)}
                />
              </div>
            ) : (
              <div className="field" style={{ flex: '1 1 160px' }}>
                <label htmlFor="mesInicio">Mês inicial</label>
                <input
                  id="mesInicio"
                  type="month"
                  value={mesInicio}
                  onChange={(e) => setMesInicio(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Linha 2 — Valores */}
          {!parcelado ? (
            <div className="row">
              <div className="field" style={{ flex: '1 1 100px' }}>
                <label htmlFor="qtd">Quantidade</label>
                <input
                  id="qtd"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: '2 1 160px' }}>
                <label htmlFor="valUnit">Valor unitário (R$)</label>
                <input
                  id="valUnit"
                  inputMode="decimal"
                  value={valorUnit}
                  onChange={(e) => setValorUnit(e.target.value)}
                />
              </div>
              {/* Total calculado */}
              <div
                className="field"
                style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
              >
                <label style={{ visibility: 'hidden' }}>Total</label>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--accent-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span className="hint" style={{ fontSize: 12 }}>Total</span>
                  <span style={{ fontWeight: 800, color: 'var(--text-h)', fontSize: 15 }}>
                    {formatBRL(totalNormal)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="row">
              <div className="field" style={{ flex: '2 1 160px' }}>
                <label htmlFor="valParc">Valor por parcela (R$)</label>
                <input
                  id="valParc"
                  inputMode="decimal"
                  value={valorParcela}
                  onChange={(e) => setValorParcela(e.target.value)}
                />
              </div>
              <div className="field" style={{ flex: '1 1 100px' }}>
                <label htmlFor="numParc">Nº de parcelas</label>
                <input
                  id="numParc"
                  inputMode="numeric"
                  value={numParcelas}
                  onChange={(e) => setNumParcelas(e.target.value)}
                />
              </div>
              {/* Resumo parcelas */}
              <div
                className="field"
                style={{ flex: '2 1 180px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
              >
                <label style={{ visibility: 'hidden' }}>Resumo</label>
                <div
                  style={{
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--accent-border)',
                    background: 'var(--accent-bg)',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {parcelasNum}× {formatBRL(n(valorParcela))}
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--text-h)', fontSize: 15 }}>
                    {formatBRL(totalParcelado)} total
                  </div>
                  {mesInicio && mesTermino ? (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {formatMesAno(mesInicio)} → {formatMesAno(mesTermino)}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Preview de parcelas */}
          {parcelado && previewParcelas.length > 0 ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px dashed var(--border)',
                background: 'var(--code-bg)',
              }}
            >
              <span className="hint" style={{ width: '100%', marginBottom: 2 }}>
                Prévia dos lançamentos a criar:
              </span>
              {previewParcelas.map((p) => (
                <span
                  key={p.num}
                  className="badge badgeBlue"
                  style={{ fontSize: 11 }}
                >
                  {formatMesAno(p.mes)} — Parcela {p.num}/{parcelasNum}
                </span>
              ))}
              {parcelasNum > 3 ? (
                <span className="hint" style={{ fontSize: 11, alignSelf: 'center' }}>
                  … mais {parcelasNum - 3} mês(es)
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Descrição */}
          <div className="field">
            <label htmlFor="desc">
              Descrição {parcelado ? '(aparece antes de "— Parcela X/N")' : '(opcional)'}
            </label>
            <input
              id="desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={parcelado ? 'ex: Máquina de lavar 2' : ''}
            />
          </div>

          <button className="btn btnPrimary" type="button" onClick={() => void salvar()}>
            {parcelado ? `Criar ${parcelasNum} parcela(s)` : 'Lançar despesa'}
          </button>
        </div>
      </section>

      {/* ── Lista do mês ──────────────────────────────────── */}
      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>
            Lançamentos — {formatMesAno(monthValue)}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 800, color: 'var(--text-h)', fontSize: 15 }}>
              {formatBRL(total)}
            </span>
            <button className="btn" type="button" onClick={() => void recarregar()}>
              Recarregar
            </button>
          </div>
        </div>

        <div className="panelBody">
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(`${d.data}T00:00:00`).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      <span className="badge badgeMuted">{d.categoria}</span>
                    </td>
                    <td className="hint">{d.descricao ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-h)' }}>
                      {formatBRL(Number(d.valor))}
                    </td>
                    <td>
                      <button
                        className="btn btnDanger"
                        type="button"
                        onClick={() => void remover(d)}
                        style={{ width: '100%' }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="hint">
                      Nenhum lançamento em {formatMesAno(monthValue)}.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {lista.length > 0 ? (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {lista.length} lançamento(s)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--text-h)' }}>
                      {formatBRL(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
