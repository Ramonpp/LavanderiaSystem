import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { deleteDespesa, fetchDespesasPorPeriodo, insertDespesasLote, updateDespesa } from '../data/despesas'
import type { Despesa } from '../types/models'
import { formatMesAno, monthBoundsLocal } from '../lib/dates'
import { formatBRL } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'
import { supabase } from '../lib/supabase'

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
export function DespesasPage({ mode }: { mode: 'criar' | 'lista' }) {
  const navigate = useNavigate()
  const location = useLocation()

  /* Filtro de mês */
  const [monthValue, setMonthValue] = useState(monthDefault)
  const [lista, setLista] = useState<Despesa[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  /* Campos do formulário */
  const [parcelado, setParcelado] = useState(false)

  /* Não-parcelado / Edição */
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

  /* Edição */
  const [editandoId, setEditandoId] = useState<string | null>(null)

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
    if (mode === 'lista') {
      void recarregar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue, mode])

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

  /* ── Limpar formulário ─────────────────────────────────── */
  function limparForm() {
    setEditandoId(null)
    setNome('')
    setValorUnit('')
    setDescricao('')
    setQuantidade('1')
    setValorParcela('')
    setNumParcelas('12')
    setParcelado(false)
  }

  /* ── Carregar despesa para edição ──────────────────────── */
  useEffect(() => {
    if (mode === 'criar') {
      const searchParams = new URLSearchParams(location.search)
      const editId = searchParams.get('edit')
      if (editId) {
        setErro(null)
        setMsg(null)
        supabase.from('despesa').select('*').eq('id', editId).single()
          .then(({ data, error }) => {
            if (error) {
              setErro(error.message)
            } else if (data) {
              setEditandoId(data.id)
              setNome(data.categoria)
              setDataLanc(data.data)
              setValorUnit(String(data.valor))
              setQuantidade('1')
              setDescricao(data.descricao ?? '')
              setParcelado(false)
            }
          })
      } else {
        limparForm()
      }
    } else {
      limparForm()
      setErro(null)
      setMsg(null)
    }
  }, [location.search, mode])

  /* ── Salvar ────────────────────────────────────────────── */
  async function salvar() {
    setErro(null)
    setMsg(null)

    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }

    if (editandoId) {
      /* Edição de lançamento existente */
      if (!dataLanc) { setErro('Data inválida.'); return }
      const totalVal = n(quantidade) * n(valorUnit)
      if (totalVal <= 0) { setErro('Valor total deve ser maior que zero.'); return }

      const { error } = await updateDespesa(editandoId, {
        data: dataLanc,
        categoria: nome.trim(),
        descricao: descricao.trim() || null,
        valor: totalVal,
      })
      if (error) { setErro(error); return }

      setMsg('Lançamento atualizado com sucesso.')
      limparForm()
      navigate('/despesas/lista')
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
      limparForm()
      navigate('/despesas/lista')
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

      setMsg(`${parcelasNum} parcela(s) lançada(s) — ${formatMesAno(mesInicio)} até ${formatMesAno(mesTermino)}..`)
      limparForm()
      navigate('/despesas/lista')
    }
  }

  async function remover(d: Despesa) {
    if (!window.confirm(`Remover o lançamento "${d.categoria}" definitivamente?`)) return
    setErro(null)
    const { error } = await deleteDespesa(d.id)
    if (error) setErro(error)
    else await recarregar()
  }

  /* ── Render ─────────────────────────────────────────────── */
  if (mode === 'criar') {
    return (
      <div className="grid" style={{ gap: 12 }}>
        <header className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>
              {editandoId ? 'Editar despesa' : 'Lançamento de despesa'}
            </h1>
            <div className="hint">
              {editandoId ? 'Altere as informações do lançamento de despesa.' : 'Lançar nova despesa simples ou parcelada.'}
            </div>
          </div>
          <button className="btn" type="button" onClick={() => navigate('/despesas/lista')}>
            Ver lançamentos
          </button>
        </header>

        {erro ? <StatusBanner kind="error" message={erro} /> : null}
        {msg ? <StatusBanner kind="success" message={msg} /> : null}

        {/* ── Formulário ────────────────────────────────────── */}
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 16, color: 'var(--accent)' }}>
              {editandoId ? 'Editar lançamento' : 'Novo lançamento'}
            </h2>

            {/* Toggle parcelado (apenas se for nova despesa) */}
            {!editandoId && (
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
            )}
          </div>

          <div className="panelBody grid" style={{ gap: 12 }}>
            {/* Linha 1 — Nome + Data/Mês */}
            <div className="row">
              <div className="field" style={{ flex: '2 1 220px' }}>
                <label htmlFor="nomeDespesa">Nome da despesa</label>
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
                    disabled={!!editandoId}
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
                {/* Total calculated */}
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

            <div className="row" style={{ gap: 8 }}>
              {editandoId && (
                <button className="btn" type="button" onClick={() => navigate('/despesas/lista')}>
                  Cancelar
                </button>
              )}
              <button className="btn btnPrimary" type="button" onClick={() => void salvar()}>
                {editandoId ? 'Salvar alterações' : (parcelado ? `Criar ${parcelasNum} parcela(s)` : 'Lançar despesa')}
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  /* mode === 'lista' (Dashboard de despesas) */
  return (
    <div className="grid" style={{ gap: 12 }}>
      <header className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Dashboard de despesas</h1>
          <div className="hint">
            Lista e totais de despesas registradas. Para registrar uma nova despesa, clique em "Nova despesa".
          </div>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <div className="field" style={{ minWidth: 160, flex: '0 0 auto' }}>
            <label htmlFor="mes" style={{ marginBottom: 4 }}>Mês exibido</label>
            <input
              id="mes"
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8 }}
            />
          </div>
          <button 
            className="btn btnPrimary" 
            type="button" 
            onClick={() => navigate('/despesas/criar')}
            style={{ alignSelf: 'end', height: 38, minHeight: 38 }}
          >
            Nova despesa
          </button>
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      {/* ── Lista do mês ──────────────────────────────────── */}
      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panelHeader">
          <h2 style={{ fontSize: 16, color: 'var(--accent)' }}>
            Lançamentos de despesas — {formatMesAno(monthValue)}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 800, color: 'var(--text-h)', fontSize: 16 }}>
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
                  <th>Nome</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(`${d.data}T00:00:00`).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      <span className="badge badgeMuted" style={{ fontWeight: 650, color: 'var(--text-h)' }}>
                        {d.categoria}
                      </span>
                    </td>
                    <td className="hint">{d.descricao ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-h)' }}>
                      {formatBRL(Number(d.valor))}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                        <button 
                          className="btn btnIcon" 
                          type="button" 
                          onClick={() => navigate(`/despesas/criar?edit=${d.id}`)} 
                          title="Editar despesa"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button 
                          className="btn btnDanger btnIcon" 
                          type="button" 
                          onClick={() => void remover(d)} 
                          title="Excluir despesa"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="hint" style={{ textAlign: 'center', padding: 24 }}>
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
