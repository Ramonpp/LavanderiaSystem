import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { deleteClienteHard, fetchClientes, insertCliente, updateCliente } from '../data/clientes'
import type { Cliente, ClienteFormaPagamento, ClientePlano } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'

const PLANO_OPCOES: Array<{ value: ClientePlano; label: string }> = [
  { value: 'pagou', label: 'Uso pagou' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'vaneide', label: 'Vaneide' },
]

const FORMA_OPCOES: Array<{ value: ClienteFormaPagamento; label: string }> = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
]

export function ClientesPage({ mode = 'lista' }: { mode?: 'criar' | 'lista' }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [itens, setItens] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const itensFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    if (!termo) return itens
    return itens.filter((c) => {
      const nome = (c.nome || '').toLowerCase()
      const documento = (c.documento || '').toLowerCase()
      const telefone = (c.telefone || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      const condominio = (c.condominio || '').toLowerCase()
      const bloco = (c.bloco || '').toLowerCase()
      const apartamento = (c.apartamento || '').toLowerCase()
      return (
        nome.includes(termo) ||
        documento.includes(termo) ||
        telefone.includes(termo) ||
        email.includes(termo) ||
        condominio.includes(termo) ||
        bloco.includes(termo) ||
        apartamento.includes(termo)
      )
    })
  }, [itens, busca])

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [condominio, setCondominio] = useState('')
  const [bloco, setBloco] = useState('')
  const [apartamento, setApartamento] = useState('')
  const [plano, setPlano] = useState<ClientePlano>('pagou')
  const [formaPagamento, setFormaPagamento] = useState<ClienteFormaPagamento>('pix')
  const [diaPagamento, setDiaPagamento] = useState<number | null>(null)
  const [ativo, setAtivo] = useState(true)

  async function recarregar() {
    setErro(null)
    const { data, error } = await fetchClientes(mostrarInativos)
    if (error) setErro(error)
    setItens(data)
  }

  useEffect(() => {
    recarregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarInativos])

  useEffect(() => {
    if (editId && itens.length > 0) {
      const found = itens.find(x => x.id === editId)
      if (found) {
        preencher(found)
      }
    } else if (!editId) {
      limparForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, itens])

  function limparForm() {
    setEditandoId(null)
    setNome('')
    setDocumento('')
    setTelefone('')
    setEmail('')
    setEndereco('')
    setCondominio('')
    setBloco('')
    setApartamento('')
    setPlano('pagou')
    setFormaPagamento('pix')
    setDiaPagamento(null)
    setAtivo(true)
    setMsg(null)
  }

  function cancelarEdicao() {
    limparForm()
    navigate('/clientes/lista')
  }

  function preencher(c: Cliente) {
    setEditandoId(c.id)
    setNome(c.nome)
    setDocumento(c.documento ?? '')
    setTelefone(c.telefone ?? '')
    setEmail(c.email ?? '')
    setEndereco(c.endereco ?? '')
    setCondominio(c.condominio ?? '')
    setBloco(c.bloco ?? '')
    setApartamento(c.apartamento ?? '')
    setPlano(c.plano ?? 'pagou')
    setFormaPagamento(c.forma_pagamento ?? 'pix')
    setDiaPagamento(c.dia_pagamento ?? null)
    setAtivo(c.ativo)
    setMsg(null)
  }

  async function salvar() {
    setErro(null)
    setMsg(null)
    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }

    if (editandoId) {
      const { error } = await updateCliente(editandoId, {
        nome: nome.trim(),
        documento: documento.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        endereco: endereco.trim() || null,
        condominio: condominio.trim() || null,
        bloco: bloco.trim() || null,
        apartamento: apartamento.trim() || null,
        plano,
        forma_pagamento: formaPagamento,
        dia_pagamento: plano === 'mensal' ? (diaPagamento || null) : null,
        ativo,
      })
      if (error) { setErro(error); return }
      setMsg('Cliente atualizado.')
      limparForm()
    } else {
      const { error } = await insertCliente({
        nome: nome.trim(),
        documento: documento.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        endereco: endereco.trim() || null,
        condominio: condominio.trim() || null,
        bloco: bloco.trim() || null,
        apartamento: apartamento.trim() || null,
        plano,
        forma_pagamento: formaPagamento,
        dia_pagamento: plano === 'mensal' ? (diaPagamento || null) : null,
        ativo,
      })
      if (error) { setErro(error); return }
      setMsg('Cliente cadastrado.')
      limparForm()
    }
    await recarregar()
    navigate('/clientes/lista')
  }

  async function excluir(c: Cliente) {
    setErro(null)
    const { error } = await deleteClienteHard(c.id)
    if (error) setErro(error)
    else {
      setDeletingId(null)
      await recarregar()
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Clientes</h1>
        <div className="hint">Cadastre hotéis, condomínios, clínicas e demais clientes. Os campos de bloco e apartamento atendem residenciais.</div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      {mode === 'criar' && (
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 16 }}>{editandoId ? 'Editar cliente' : 'Novo cliente'}</h2>
            <button className="btn" type="button" onClick={cancelarEdicao}>
              Cancelar
            </button>
          </div>
          <div className="panelBody grid" style={{ gap: 12 }}>
            <div className="row">
              <div className="field">
                <label htmlFor="nome">Nome</label>
                <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="fone">Telefone</label>
                <input id="fone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="cond">Condomínio</label>
                <input id="cond" value={condominio} onChange={(e) => setCondominio(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="apto">Apartamento</label>
                <input id="apto" value={apartamento} onChange={(e) => setApartamento(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="bloco">Bloco</label>
                <input id="bloco" value={bloco} onChange={(e) => setBloco(e.target.value)} />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label htmlFor="plano">Plano</label>
                <select id="plano" value={plano} onChange={(e) => {
                  const val = e.target.value as ClientePlano
                  setPlano(val)
                  if (val !== 'mensal') setDiaPagamento(null)
                }}>
                  {PLANO_OPCOES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {plano === 'mensal' && (
                <div className="field">
                  <label htmlFor="diaPagto">Dia do pagamento</label>
                  <select
                    id="diaPagto"
                    value={diaPagamento ?? ''}
                    onChange={(e) => setDiaPagamento(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Selecione...</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field">
                <label htmlFor="forma">Forma de pagamento</label>
                <select id="forma" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value as ClienteFormaPagamento)}>
                  {FORMA_OPCOES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {editandoId ? (
              <>
                <div className="row">
                  <div className="field">
                    <label htmlFor="doc">Documento</label>
                    <input id="doc" value={documento} onChange={(e) => setDocumento(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="field" style={{ flex: '1 1 100%' }}>
                    <label htmlFor="endereco">Endereço</label>
                    <textarea id="endereco" rows={2} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <div className="hint">Documento, email e endereço podem ser preenchidos depois clicando em Editar.</div>
            )}

            <div className="row">
              <div className="field">
                <label>Status</label>
                <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setAtivo(true)}
                    style={{
                      flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: ativo ? 'var(--panel)' : 'transparent',
                      color: ativo ? 'var(--text-h)' : 'var(--muted)',
                      boxShadow: ativo ? 'var(--shadow)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAtivo(false)}
                    style={{
                      flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      background: !ativo ? 'var(--panel)' : 'transparent',
                      color: !ativo ? 'var(--text-h)' : 'var(--muted)',
                      boxShadow: !ativo ? 'var(--shadow)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    Inativo
                  </button>
                </div>
              </div>
              <button className="btn btnPrimary" type="button" onClick={salvar}>
                Salvar
              </button>
            </div>
          </div>
        </section>
      )}

      {mode === 'lista' && (
        <section className="panel">
          <div className="panelHeader">
            <h2 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              Clientes cadastrados
              <span className="badge badgeMuted" style={{ fontSize: 12, padding: '2px 6px' }}>{itens.length}</span>
            </h2>
            <div className="row" style={{ gap: 12, alignItems: 'center' }}>
              <label className="switch-container">
                <input 
                  type="checkbox" 
                  className="switch-input" 
                  checked={mostrarInativos} 
                  onChange={(e) => setMostrarInativos(e.target.checked)} 
                />
                <span className="switch-slider"></span>
                <span>Mostrar inativos</span>
              </label>
              <button className="btn btnIcon" type="button" onClick={recarregar} title="Recarregar" style={{ minWidth: 36, width: 36, height: 36, padding: 0 }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
          </div>
          <div className="panelBody">
            {/* Filtros / Busca */}
            <div className="row" style={{ marginBottom: 14, gap: 12, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
                <div className="field" style={{ minWidth: 240, flex: '1 1 auto' }}>
                  <label htmlFor="busca-cliente" style={{ marginBottom: 4 }}>Buscar Cliente</label>
                  <input
                    id="busca-cliente"
                    type="text"
                    placeholder="Nome, condomínio, fone..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  />
                </div>
              </div>
              <div className="hint" style={{ fontWeight: 600 }}>
                {itensFiltrados.length} {itensFiltrados.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
              </div>
            </div>

            {/* Desktop View */}
            <div className="tableWrap desktop-only">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Condomínio</th>
                    <th>Bloco</th>
                    <th>Apto</th>
                    <th>Plano</th>
                    <th>Pagamento</th>
                    <th>Telefone</th>
                    <th>Email</th>
                    <th>Ativo</th>
                    <th style={{ width: 220 }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{c.nome}</div>
                        <div className="hint">{c.documento ?? '—'}</div>
                      </td>
                      <td>{c.condominio ?? '—'}</td>
                      <td>{c.bloco ?? '—'}</td>
                      <td>{c.apartamento ?? '—'}</td>
                      <td>
                        <div>{PLANO_OPCOES.find((x) => x.value === c.plano)?.label ?? c.plano}</div>
                        {c.plano === 'mensal' && c.dia_pagamento && (
                          <div className="hint" style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 650, marginTop: 2 }}>
                            Dia {c.dia_pagamento}
                          </div>
                        )}
                      </td>
                      <td>{FORMA_OPCOES.find((x) => x.value === c.forma_pagamento)?.label ?? c.forma_pagamento}</td>
                      <td>{c.telefone ?? '—'}</td>
                      <td>{c.email ?? '—'}</td>
                      <td>{c.ativo ? 'sim' : 'não'}</td>
                      <td>
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          {deletingId === c.id ? (
                            <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--danger)', alignSelf: 'center' }}>Confirma?</span>
                              <button
                                className="btn btnDanger"
                                type="button"
                                onClick={() => void excluir(c)}
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
                              <button className="btn btnIcon" type="button" onClick={() => navigate(`/clientes/criar?edit=${c.id}`)} title="Editar cliente">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button className="btn btnDanger btnIcon" type="button" onClick={() => setDeletingId(c.id)} title="Excluir cliente">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {itensFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="hint">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="mobile-card-list mobile-only">
              {itensFiltrados.map((c) => (
                <div key={c.id} className="mobile-card">
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-title">{c.nome}</div>
                      {c.documento && <div className="hint" style={{ fontSize: 11 }}>Doc: {c.documento}</div>}
                    </div>
                    <span className={`badge ${c.ativo ? 'badgeGreen' : 'badgeRed'}`}>
                      {c.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="mobile-card-body">
                    <div>
                      <div className="mobile-card-label">Plano</div>
                      <div className="mobile-card-value">
                        {PLANO_OPCOES.find((x) => x.value === c.plano)?.label ?? c.plano}
                        {c.plano === 'mensal' && c.dia_pagamento && ` (Dia ${c.dia_pagamento})`}
                      </div>
                    </div>
                    <div>
                      <div className="mobile-card-label">Pagamento</div>
                      <div className="mobile-card-value">
                        {FORMA_OPCOES.find((x) => x.value === c.forma_pagamento)?.label ?? c.forma_pagamento}
                      </div>
                    </div>
                    {(c.condominio || c.bloco || c.apartamento) && (
                      <div className="mobile-card-body-full">
                        <div className="mobile-card-label">Local</div>
                        <div className="mobile-card-value">
                          {[
                            c.condominio ? `Cond. ${c.condominio}` : null,
                            c.bloco ? `Bloco ${c.bloco}` : null,
                            c.apartamento ? `Apto ${c.apartamento}` : null
                          ].filter(Boolean).join(' - ')}
                        </div>
                      </div>
                    )}
                    {c.telefone && (
                      <div>
                        <div className="mobile-card-label">Telefone</div>
                        <div className="mobile-card-value">{c.telefone}</div>
                      </div>
                    )}
                    {c.email && (
                      <div>
                        <div className="mobile-card-label">Email</div>
                        <div className="mobile-card-value" style={{ wordBreak: 'break-all' }}>{c.email}</div>
                      </div>
                    )}
                  </div>
                  <div className="mobile-card-actions">
                    {deletingId === c.id ? (
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--danger)', alignSelf: 'center' }}>Confirma?</span>
                        <button
                          className="btn btnDanger"
                          type="button"
                          onClick={() => void excluir(c)}
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
                        <button className="btn btnIcon" type="button" onClick={() => navigate(`/clientes/criar?edit=${c.id}`)} title="Editar cliente">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn btnDanger btnIcon" type="button" onClick={() => setDeletingId(c.id)} title="Excluir cliente">
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
              {itensFiltrados.length === 0 && (
                <div className="hint" style={{ textAlign: 'center', padding: 20 }}>
                  Nenhum cliente encontrado.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
