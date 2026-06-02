import { useEffect, useState } from 'react'
import { deleteClienteHard, fetchClientes, insertCliente, updateCliente } from '../data/clientes'
import type { Cliente, ClienteFormaPagamento, ClientePlano } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'

const PLANO_OPCOES: Array<{ value: ClientePlano; label: string }> = [
  { value: 'pagou', label: 'Uso pagou' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
]

const FORMA_OPCOES: Array<{ value: ClienteFormaPagamento; label: string }> = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
]

export function ClientesPage() {
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [itens, setItens] = useState<Cliente[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

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
    setAtivo(true)
    setMsg(null)
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
        ativo,
      })
      if (error) { setErro(error); return }
      setMsg('Cliente cadastrado.')
      limparForm()
    }
    await recarregar()
  }

  async function excluir(c: Cliente) {
    if (!window.confirm(`Excluir cliente "${c.nome}"? (só é permitido se não houver pedidos vinculados)`)) return
    setErro(null)
    const { error } = await deleteClienteHard(c.id)
    if (error) setErro(error)
    else await recarregar()
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Clientes</h1>
        <div className="hint">Cadastre hotéis, condomínios, clínicas e demais clientes. Os campos de bloco e apartamento atendem residenciais.</div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>{editandoId ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button className="btn" type="button" onClick={limparForm}>
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
              <label htmlFor="bloco">Bloco</label>
              <input id="bloco" value={bloco} onChange={(e) => setBloco(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="apto">Apartamento</label>
              <input id="apto" value={apartamento} onChange={(e) => setApartamento(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="plano">Plano</label>
              <select id="plano" value={plano} onChange={(e) => setPlano(e.target.value as ClientePlano)}>
                {PLANO_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
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

          <div className="row" style={{ alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-h)', marginBottom: 0 }}>
              <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
              Mostrar inativos
            </label>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Clientes cadastrados</h2>
          <button className="btn" type="button" onClick={recarregar}>
            Recarregar
          </button>
        </div>
        <div className="panelBody">
          <div className="tableWrap">
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
                {itens.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 650, color: 'var(--text-h)' }}>{c.nome}</div>
                      <div className="hint">{c.documento ?? '—'}</div>
                    </td>
                    <td>{c.condominio ?? '—'}</td>
                    <td>{c.bloco ?? '—'}</td>
                    <td>{c.apartamento ?? '—'}</td>
                    <td>{PLANO_OPCOES.find((x) => x.value === c.plano)?.label ?? c.plano}</td>
                    <td>{FORMA_OPCOES.find((x) => x.value === c.forma_pagamento)?.label ?? c.forma_pagamento}</td>
                    <td>{c.telefone ?? '—'}</td>
                    <td>{c.email ?? '—'}</td>
                    <td>{c.ativo ? 'sim' : 'não'}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn" type="button" onClick={() => preencher(c)}>
                          Editar
                        </button>
                        <button className="btn btnDanger" type="button" onClick={() => void excluir(c)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="hint">
                      Nenhum cliente cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
