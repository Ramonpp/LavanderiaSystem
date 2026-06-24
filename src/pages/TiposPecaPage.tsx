import { useEffect, useState } from 'react'
import { deleteTipoPeca, fetchTiposPeca, insertTipoPeca, popularCatalogoPadrao, updateTipoPeca } from '../data/tiposPeca'
import type { TipoPeca } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'

export function TiposPecaPage() {
  const [itens, setItens] = useState<TipoPeca[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [pesoRef, setPesoRef] = useState('')

  async function recarregar() {
    setErro(null)
    const { data, error } = await fetchTiposPeca()
    if (error) setErro(error)
    setItens(data)
  }

  useEffect(() => {
    void recarregar()
  }, [])

  function limpar() {
    setEditandoId(null)
    setNome('')
    setDescricao('')
    setPesoRef('')
    setMsg(null)
  }

  function editar(tp: TipoPeca) {
    setEditandoId(tp.id)
    setNome(tp.nome)
    setDescricao(tp.descricao ?? '')
    setPesoRef(tp.peso_referencia_kg == null ? '' : String(tp.peso_referencia_kg))
    setMsg(null)
  }

  async function salvar() {
    setErro(null)
    setMsg(null)
    if (!nome.trim()) {
      setErro('Nome da peça é obrigatório.')
      return
    }

    const pesoParsed = pesoRef.trim().length === 0 ? null : Number(pesoRef.replace(',', '.'))
    if (pesoParsed !== null && !Number.isFinite(pesoParsed)) {
      setErro('Peso de referência inválido.')
      return
    }

    if (editandoId) {
      const { error } = await updateTipoPeca(editandoId, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        peso_referencia_kg: pesoParsed,
      })
      if (error) setErro(error)
      else {
        setMsg('Tipo atualizado.')
        limpar()
      }
    } else {
      const { error } = await insertTipoPeca({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        peso_referencia_kg: pesoParsed,
      })
      if (error) setErro(error)
      else {
        setMsg('Tipo cadastrado.')
        limpar()
      }
    }
    await recarregar()
  }

  async function excluir(tp: TipoPeca) {
    setErro(null)
    const { error } = await deleteTipoPeca(tp.id)
    if (error) setErro(error)
    else {
      setDeletingId(null)
      await recarregar()
    }
  }

  async function preencherPadrao() {
    setErro(null)
    setMsg(null)
    const { inseridos, error } = await popularCatalogoPadrao()
    if (error) { setErro(error); return }
    if (inseridos === 0) setMsg('Catálogo padrão já está completo — nenhuma peça nova foi adicionada.')
    else { setMsg(`${inseridos} peça(s) de enxoval adicionada(s) ao catálogo.`); await recarregar() }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Tipos de peça</h1>
        <div className="hint">
          Use para registrar enxoval (lençóis cobertores toalhas etc.) com peso médio opcional para conferências.
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>{editandoId ? 'Editar' : 'Novo tipo'}</h2>
          <button className="btn" type="button" onClick={limpar}>
            Cancelar
          </button>
        </div>
        <div className="panelBody grid" style={{ gap: 10 }}>
          <div className="row">
            <div className="field">
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pesoRef">Peso referência (kg, opcional)</label>
              <input id="pesoRef" inputMode="decimal" value={pesoRef} onChange={(e) => setPesoRef(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ minWidth: '100%' }}>
            <label htmlFor="desc">Descrição</label>
            <textarea id="desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <button className="btn btnPrimary" type="button" onClick={() => void salvar()}>
            Salvar
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Catálogo</h2>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <button className="btn btnPrimary" type="button" onClick={() => void preencherPadrao()}>
              Preencher catálogo padrão
            </button>
            <button className="btn btnIcon" type="button" onClick={() => void recarregar()} title="Recarregar" style={{ minWidth: 36, width: 36, height: 36, padding: 0 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>
        <div className="panelBody">
          {/* Desktop View */}
          <div className="tableWrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Peso ref.</th>
                  <th>Descrição</th>
                  <th style={{ width: 140, textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((tp) => (
                  <tr key={tp.id}>
                    <td style={{ fontWeight: 650 }}>{tp.nome}</td>
                    <td>{tp.peso_referencia_kg == null ? '—' : Number(tp.peso_referencia_kg).toLocaleString('pt-BR')}</td>
                    <td className="hint">{tp.descricao ?? '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                        {deletingId === tp.id ? (
                          <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--danger)', alignSelf: 'center' }}>Confirma?</span>
                            <button
                              className="btn btnDanger"
                              type="button"
                              onClick={() => void excluir(tp)}
                              style={{ padding: '4px 8px', fontSize: 11, minHeight: 30, height: 30 }}
                            >
                              Sim
                            </button>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => setDeletingId(null)}
                              style={{ padding: '4px 8px', fontSize: 11, minHeight: 30, height: 30 }}
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <>
                            <button className="btn btnIcon" type="button" onClick={() => editar(tp)} title="Editar tipo de peça">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button className="btn btnDanger btnIcon" type="button" onClick={() => setDeletingId(tp.id)} title="Excluir tipo de peça">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="hint">
                      Nenhum tipo cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="mobile-card-list mobile-only">
            {itens.map((tp) => (
              <div key={tp.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div className="mobile-card-title">{tp.nome}</div>
                    {tp.peso_referencia_kg != null && (
                      <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>
                        Peso ref: {Number(tp.peso_referencia_kg).toLocaleString('pt-BR')} kg
                      </div>
                    )}
                  </div>
                </div>
                {tp.descricao && (
                  <div className="mobile-card-body" style={{ gridTemplateColumns: '1fr' }}>
                    <div>
                      <div className="mobile-card-label">Descrição</div>
                      <div className="mobile-card-value">{tp.descricao}</div>
                    </div>
                  </div>
                )}
                <div className="mobile-card-actions">
                  {deletingId === tp.id ? (
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--danger)', alignSelf: 'center' }}>Confirma?</span>
                      <button
                        className="btn btnDanger"
                        type="button"
                        onClick={() => void excluir(tp)}
                        style={{ padding: '4px 8px', fontSize: 11, minHeight: 30, height: 30 }}
                      >
                        Sim
                      </button>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => setDeletingId(null)}
                        style={{ padding: '4px 8px', fontSize: 11, minHeight: 30, height: 30 }}
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <>
                      <button className="btn btnIcon" type="button" onClick={() => editar(tp)} title="Editar tipo de peça">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className="btn btnDanger btnIcon" type="button" onClick={() => setDeletingId(tp.id)} title="Excluir tipo de peça">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {itens.length === 0 && (
              <div className="hint" style={{ textAlign: 'center', padding: 20 }}>
                Nenhum tipo de peça cadastrado.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
