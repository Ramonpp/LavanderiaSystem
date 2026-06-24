import { useEffect, useState } from 'react'
import { deleteMaquina, fetchMaquinas, insertMaquina, updateMaquina } from '../data/maquinas'
import type { Maquina, MaquinaTipo } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'

export function MaquinasPage() {
  const [itens, setItens] = useState<Maquina[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<MaquinaTipo>('lavagem')
  const [capacidadeKg, setCapacidadeKg] = useState('12')
  const [minutosCiclo, setMinutosCiclo] = useState('')
  const [ciclosDia, setCiclosDia] = useState('6')
  const [ativo, setAtivo] = useState(true)

  async function recarregar() {
    setErro(null)
    const { data, error } = await fetchMaquinas()
    if (error) setErro(error)
    setItens(data)
  }

  useEffect(() => {
    void recarregar()
  }, [])

  function limpar() {
    setEditandoId(null)
    setNome('')
    setTipo('lavagem')
    setCapacidadeKg('12')
    setMinutosCiclo('')
    setCiclosDia('6')
    setAtivo(true)
    setMsg(null)
  }

  function editar(m: Maquina) {
    setEditandoId(m.id)
    setNome(m.nome)
    setTipo(m.tipo)
    setCapacidadeKg(String(m.capacidade_kg))
    setMinutosCiclo(m.minutos_por_ciclo == null ? '' : String(m.minutos_por_ciclo))
    setCiclosDia(String(m.ciclos_por_dia_util))
    setAtivo(m.ativo)
    setMsg(null)
  }

  async function salvar() {
    setErro(null)
    setMsg(null)

    const capKg = Number(capacidadeKg.replace(',', '.'))
    const ciclos = Number(ciclosDia.replace(',', '.'))
    const mins = minutosCiclo.trim().length === 0 ? null : Number(minutosCiclo.replace(',', '.'))

    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }
    if (!Number.isFinite(capKg) || capKg <= 0) {
      setErro('Capacidade (kg) inválida.')
      return
    }
    if (!Number.isFinite(ciclos) || ciclos <= 0) {
      setErro('Ciclos por dia útil inválidos.')
      return
    }
    if (mins !== null && (!Number.isFinite(mins) || mins <= 0)) {
      setErro('Minutos por ciclo inválidos.')
      return
    }

    if (editandoId) {
      const { error } = await updateMaquina(editandoId, {
        nome: nome.trim(),
        tipo,
        capacidade_kg: capKg,
        minutos_por_ciclo: mins,
        ciclos_por_dia_util: ciclos,
        ativo,
      })
      if (error) setErro(error)
      else {
        setMsg('Máquina atualizada.')
        limpar()
      }
    } else {
      const { error } = await insertMaquina({
        nome: nome.trim(),
        tipo,
        capacidade_kg: capKg,
        minutos_por_ciclo: mins,
        ciclos_por_dia_util: ciclos,
        ativo,
      })
      if (error) setErro(error)
      else {
        setMsg('Máquina cadastrada.')
        limpar()
      }
    }

    await recarregar()
  }

  async function excluir(m: Maquina) {
    setErro(null)
    const { error } = await deleteMaquina(m.id)
    if (error) setErro(error)
    else {
      setDeletingId(null)
      await recarregar()
    }
  }

  async function toggleAtivo(m: Maquina) {
    setErro(null)
    const { error } = await updateMaquina(m.id, { ativo: !m.ativo })
    if (error) setErro(error)
    else await recarregar()
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Maquinário</h1>
        <div className="hint">Capacidade diária aproximada = capacidade nominal × ciclos por dia útil.</div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>{editandoId ? 'Editar' : 'Nova máquina'}</h2>
          <button className="btn" type="button" onClick={limpar}>
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
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as MaquinaTipo)}>
                <option value="lavagem">lavagem</option>
                <option value="secagem">secagem</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cap">Capacidade (kg por ciclo)</label>
              <input id="cap" inputMode="decimal" value={capacidadeKg} onChange={(e) => setCapacidadeKg(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="ciclos">Ciclos por dia útil</label>
              <input id="ciclos" inputMode="decimal" value={ciclosDia} onChange={(e) => setCiclosDia(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="mins">Minutos por ciclo (opcional)</label>
              <input id="mins" inputMode="decimal" value={minutosCiclo} onChange={(e) => setMinutosCiclo(e.target.value)} />
            </div>
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
          </div>

          <button className="btn btnPrimary" type="button" onClick={() => void salvar()}>
            Salvar
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Lista</h2>
          <button className="btn btnIcon" type="button" onClick={() => void recarregar()} title="Recarregar" style={{ minWidth: 36, width: 36, height: 36, padding: 0 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
        <div className="panelBody">
          {/* Desktop View */}
          <div className="tableWrap desktop-only">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>kg/ciclo</th>
                  <th>ciclos/dia</th>
                  <th>kg/dia (nominal)</th>
                  <th>Ativa</th>
                  <th style={{ width: 180, textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((m) => {
                  const kgDiaNominal = Number(m.capacidade_kg) * Number(m.ciclos_por_dia_util)
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 650 }}>{m.nome}</td>
                      <td>{m.tipo}</td>
                      <td>{Number(m.capacidade_kg).toLocaleString('pt-BR')}</td>
                      <td>{Number(m.ciclos_por_dia_util).toLocaleString('pt-BR')}</td>
                      <td>{kgDiaNominal.toLocaleString('pt-BR')}</td>
                      <td>{m.ativo ? 'sim' : 'não'}</td>
                      <td>
                        <div className="row" style={{ gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                          {deletingId === m.id ? (
                            <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--danger)', alignSelf: 'center' }}>Confirma?</span>
                              <button
                                className="btn btnDanger"
                                type="button"
                                onClick={() => void excluir(m)}
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
                              <button className="btn btnIcon" type="button" onClick={() => editar(m)} title="Editar máquina">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button className="btn" type="button" onClick={() => void toggleAtivo(m)} style={{ padding: '6px 12px', fontSize: 12 }}>
                                {m.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                              <button className="btn btnDanger btnIcon" type="button" onClick={() => setDeletingId(m.id)} title="Excluir máquina">
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
                  )
                })}
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="hint">
                      Nenhuma máquina cadastrada ou Supabase/schema pendente.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="mobile-card-list mobile-only">
            {itens.map((m) => {
              const kgDiaNominal = Number(m.capacidade_kg) * Number(m.ciclos_por_dia_util)
              return (
                <div key={m.id} className="mobile-card">
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-title">{m.nome}</div>
                      <div className="hint" style={{ fontSize: 11, marginTop: 2 }}>{m.tipo}</div>
                    </div>
                    <span className={`badge ${m.ativo ? 'badgeGreen' : 'badgeRed'}`}>
                      {m.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  
                  <div className="mobile-card-body">
                    <div>
                      <div className="mobile-card-label">Capacidade</div>
                      <div className="mobile-card-value">{Number(m.capacidade_kg).toLocaleString('pt-BR')} kg</div>
                    </div>
                    <div>
                      <div className="mobile-card-label">Ciclos/Dia</div>
                      <div className="mobile-card-value">{Number(m.ciclos_por_dia_util).toLocaleString('pt-BR')}</div>
                    </div>
                    <div>
                      <div className="mobile-card-label">Kg/Dia (Nominal)</div>
                      <div className="mobile-card-value">{kgDiaNominal.toLocaleString('pt-BR')} kg</div>
                    </div>
                    <div>
                      <div className="mobile-card-label">Duração</div>
                      <div className="mobile-card-value">{m.minutos_por_ciclo != null ? `${m.minutos_por_ciclo} min` : '60 min'}</div>
                    </div>
                  </div>
                  
                  <div className="mobile-card-actions">
                    {deletingId === m.id ? (
                      <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--danger)', alignSelf: 'center' }}>Confirma?</span>
                        <button
                          className="btn btnDanger"
                          type="button"
                          onClick={() => void excluir(m)}
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
                        <button className="btn" type="button" onClick={() => void toggleAtivo(m)} style={{ padding: '6px 12px', fontSize: 12, marginRight: 'auto' }}>
                          {m.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button className="btn btnIcon" type="button" onClick={() => editar(m)} title="Editar máquina">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn btnDanger btnIcon" type="button" onClick={() => setDeletingId(m.id)} title="Excluir máquina">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {itens.length === 0 && (
              <div className="hint" style={{ textAlign: 'center', padding: 20 }}>
                Nenhuma máquina cadastrada.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
