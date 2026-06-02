import { useEffect, useMemo, useState } from 'react'
import {
  fetchItensPorPedidos,
  fetchPedidos,
  insertPedidoComItens,
  replaceItensPedido,
  deletePedido,
  updatePedido,
} from '../data/pedidos'
import { fetchClientes } from '../data/clientes'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { Cliente, ItemPedido, OrderStatus, PagamentoStatus, PedidoCliente, TipoPeca } from '../types/models'
import { receitaPedido } from '../domain/finance'
import { formatBRL } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'
import { StatusBadge } from '../components/StatusBadge'
import { enviarCobrancaWebhook } from '../data/webhook'

type ItemLinha = {
  key: string
  tipo_peca_id: string
  quantidade: string
}

function newKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const PEDIDO_MINIMO: Array<{ nome: string; quantidade: string }> = [
  { nome: 'Toalha de piso',  quantidade: '1' },
  { nome: 'Toalha de banho', quantidade: '2' },
  { nome: 'Toalha de rosto', quantidade: '1' },
  { nome: 'Lencol casal',    quantidade: '1' },
  { nome: 'Fronha',          quantidade: '2' },
]

function resolverTipoId(tipos: import('../types/models').TipoPeca[], nome: string): string {
  const n = nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return tipos.find((t) =>
    t.nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') === n,
  )?.id ?? ''
}

function gerarLinhasPadrao(tipos: import('../types/models').TipoPeca[]): ItemLinha[] {
  const linhas = PEDIDO_MINIMO
    .map(({ nome, quantidade }) => ({
      key: newKey(),
      tipo_peca_id: resolverTipoId(tipos, nome),
      quantidade,
    }))
    .filter((l) => l.tipo_peca_id !== '')
  return linhas.length > 0 ? linhas : [{ key: newKey(), tipo_peca_id: tipos[0]?.id ?? '', quantidade: '1' }]
}

const statusOpções: OrderStatus[] = ['recebido', 'em_lavagem', 'pronto', 'entregue', 'cancelado']
const pagamentoOpcoes: Array<{ value: PagamentoStatus; label: string }> = [
  { value: 'devendo', label: 'Devendo' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'pago', label: 'Pago' },
]

export function PedidosPage() {
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tipos, setTipos] = useState<TipoPeca[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [dataPedido, setDataPedido] = useState(() => new Date().toISOString().slice(0, 10))
  const [dataPrev, setDataPrev] = useState('')
  const [status, setStatus] = useState<OrderStatus>('recebido')
  const [pagamentoStatus, setPagamentoStatus] = useState<PagamentoStatus>('devendo')
  const [pesoKg, setPesoKg] = useState('')

  type PricingMode = 'kg' | 'fixo'
  const [modoPreco, setModoPreco] = useState<PricingMode>('kg')
  const [precoKg, setPrecoKg] = useState('17')
  const [precoFixo, setPrecoFixo] = useState('')

  const [observacoes, setObservacoes] = useState('')

  const [itensLinhas, setItensLinhas] = useState<ItemLinha[]>([])

  const primeiraPecaDisponível = useMemo(() => tipos[0]?.id ?? '', [tipos])
  const DEFAULT_PRECO_POR_KG_48H = '17'

  async function reloadAll() {
    setErro(null)
    const [peds, cls, tp] = await Promise.all([
      fetchPedidos(),
      fetchClientes(true),
      fetchTiposPeca(),
    ])

    setPedidos(peds.data)
    setClientes(cls.data)
    setTipos(tp.data)

    const e = peds.error ?? cls.error ?? tp.error ?? null
    if (e) setErro(e)

    setClienteId((cur) => {
      if (cur) return cur
      const primeiro = cls.data.find((c) => c.ativo)?.id ?? cls.data[0]?.id
      return primeiro ?? ''
    })

    setItensLinhas((cur) => (cur.length > 0 ? cur : gerarLinhasPadrao(tp.data)))
  }

  useEffect(() => {
    void reloadAll()
  }, [])

  useEffect(() => {
    if (editandoId) return
    setModoPreco('kg')
    setPrecoKg(DEFAULT_PRECO_POR_KG_48H)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editandoId])

  function limparForm() {
    setEditandoId(null)
    const d = new Date().toISOString().slice(0, 10)
    setDataPedido(d)
    setDataPrev(addDaysIso(d, 2))
    setStatus('recebido')
    setPagamentoStatus('devendo')
    setPesoKg('')
    setModoPreco('kg')
    setPrecoKg('17')
    setPrecoFixo('')
    setObservacoes('')
    setItensLinhas(gerarLinhasPadrao(tipos))
    setMsg(null)
  }

  function adicionarLinhaItem() {
    setItensLinhas((xs) => [
      ...xs,
      { key: newKey(), tipo_peca_id: primeiraPecaDisponível, quantidade: '1' },
    ])
  }

  function removerLinhaItem(key: string) {
    setItensLinhas((xs) => (xs.length <= 1 ? xs : xs.filter((x) => x.key !== key)))
  }

  async function preencherEdição(p: PedidoCliente) {
    setErro(null)
    setMsg(null)
    setEditandoId(p.id)
    setClienteId(p.cliente_id)
    setDataPedido(p.data_pedido)
    setDataPrev(p.data_prevista_entrega ?? '')
    setStatus(p.status)
    setPagamentoStatus(p.pagamento_status ?? 'devendo')
    setPesoKg(String(p.peso_kg ?? ''))

    const temFixo = p.preco_fixo != null
    const temKg = p.preco_por_kg != null
    if (temFixo && !temKg) setModoPreco('fixo')
    else setModoPreco('kg')
    setPrecoKg(p.preco_por_kg == null ? '' : String(p.preco_por_kg))
    setPrecoFixo(p.preco_fixo == null ? '' : String(p.preco_fixo))
    setObservacoes(p.observacoes ?? '')

    const { data } = await fetchItensPorPedidos([p.id])
    const linhas: ItemLinha[] =
      data.length > 0
        ? data.map((it) => ({
            key: it.id ?? newKey(),
            tipo_peca_id: it.tipo_peca_id,
            quantidade: String(it.quantidade),
          }))
        : [{ key: newKey(), tipo_peca_id: primeiraPecaDisponível, quantidade: '1' }]
    setItensLinhas(linhas)
  }

  function montarItensPersistência(): Omit<ItemPedido, 'id' | 'pedido_id' | 'criado_em'>[] {
    const resultado: Omit<ItemPedido, 'id' | 'pedido_id' | 'criado_em'>[] = []

    for (const l of itensLinhas) {
      if (!l.tipo_peca_id) continue

      const q = Math.round(Number(String(l.quantidade).replace(',', '.')))
      if (!Number.isFinite(q) || q <= 0) {
        continue
      }

      resultado.push({
        tipo_peca_id: l.tipo_peca_id,
        quantidade: q,
        peso_linha_kg: null,
      })
    }

    return resultado
  }

  function addDaysIso(iso: string, days: number) {
    const d = new Date(`${iso}T00:00:00`)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  useEffect(() => {
    if (editandoId) return
    if (dataPedido) setDataPrev(addDaysIso(dataPedido, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataPedido, editandoId])

  async function salvarPedido() {
    setErro(null)
    setMsg(null)

    if (!clienteId) {
      setErro('Selecione um cliente.')
      return
    }
    const peso = Number(String(pesoKg).replace(',', '.'))
    if (!Number.isFinite(peso) || peso < 0) {
      setErro('Peso (kg) inválido.')
      return
    }

    const pk = Number(String(precoKg).replace(',', '.'))
    const pf = Number(String(precoFixo).replace(',', '.'))

    let preco_por_kg: number | null = null
    let preco_fixo: number | null = null

    if (modoPreco === 'kg') {
      if (!Number.isFinite(pk) || pk < 0) {
        setErro('Preço por kg inválido.')
        return
      }
      preco_por_kg = pk
      preco_fixo = null
    } else {
      if (!Number.isFinite(pf) || pf < 0) {
        setErro('Preço fixo inválido.')
        return
      }
      preco_fixo = pf
      preco_por_kg = null
    }

    const itensLimpos = montarItensPersistência()
    if (itensLimpos.length === 0) {
      setErro('Informe ao menos uma linha de item com tipo e quantidade válida.')
      return
    }

    const pedidoBase = {
      cliente_id: clienteId,
      data_pedido: dataPedido,
      data_prevista_entrega: dataPrev.trim().length === 0 ? null : dataPrev,
      status,
      pagamento_status: pagamentoStatus,
      peso_kg: peso,
      preco_por_kg,
      preco_fixo,
      observacoes: observacoes.trim().length === 0 ? null : observacoes.trim(),
    }

    if (editandoId) {
      const { error: u } = await updatePedido(editandoId, pedidoBase)
      if (u) {
        setErro(u)
        return
      }
      const { error: r } = await replaceItensPedido(editandoId, itensLimpos)
      if (r) {
        setErro(r)
        return
      }
      setMsg('Pedido atualizado.')
      limparForm()
    } else {
      const { error: ins } = await insertPedidoComItens({
        pedido: pedidoBase,
        itens: itensLimpos,
      })
      if (ins) {
        setErro(ins)
        return
      }
      setMsg('Pedido criado.')
      limparForm()
    }

    await reloadAll()
  }

  async function excluir(p: PedidoCliente) {
    if (!window.confirm('Excluir pedido e suas linhas?')) return
    setErro(null)
    const { error } = await deletePedido(p.id)
    if (error) setErro(error)
    else await reloadAll()
  }

  useEffect(() => {
    setItensLinhas((xs) =>
      xs.map((l) =>
        !l.tipo_peca_id && primeiraPecaDisponível
          ? { ...l, tipo_peca_id: primeiraPecaDisponível }
          : l,
      ),
    )
  }, [primeiraPecaDisponível])

  async function enviarCobranca(p: PedidoCliente) {
    setErro(null)
    setMsg(null)
    setEnviandoId(p.id)
    try {
      const cli = clientes.find((c) => c.id === p.cliente_id) ?? null
      const { data: itens, error: eItens } = await fetchItensPorPedidos([p.id])
      if (eItens) {
        setErro(eItens)
        return
      }

      const itensTxt = itens
        .map((it) => {
          const nome = tipos.find((t) => t.id === it.tipo_peca_id)?.nome ?? 'Peça'
          return `${it.quantidade}x ${nome}`
        })
        .join(', ')

      const valor = receitaPedido(p)
      const texto = `Cobrança do pedido ${new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR')}: ${formatBRL(valor)}. Itens: ${itensTxt || '—'}.`

      const { error: w } = await enviarCobrancaWebhook({
        type: 'cobranca',
        cliente: {
          id: p.cliente_id,
          nome: p.cliente?.nome ?? cli?.nome ?? '—',
          telefone: cli?.telefone ?? null,
          email: cli?.email ?? null,
          plano: cli?.plano,
          forma_pagamento: cli?.forma_pagamento,
        },
        pedido: {
          id: p.id,
          data_pedido: p.data_pedido,
          status: p.status,
          pagamento_status: p.pagamento_status,
          valor,
        },
        itens: itens.map((it) => ({
          nome: tipos.find((t) => t.id === it.tipo_peca_id)?.nome ?? 'Peça',
          quantidade: it.quantidade,
        })),
        texto,
      })
      if (w) setErro(w)
      else setMsg('Cobrança enviada no webhook.')
    } finally {
      setEnviandoId(null)
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Pedidos</h1>
        <div className="hint">
          Padrão sugerido: <strong>R$ 17/kg</strong> com entrega em <strong>48h</strong>. Ajuste por pedido quando necessário.
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>{editandoId ? 'Editar pedido' : 'Novo pedido'}</h2>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="button" onClick={limparForm}>
              Cancelar
            </button>
            <button className="btn" type="button" onClick={() => void reloadAll()}>
              Recarregar
            </button>
          </div>
        </div>
        <div className="panelBody grid" style={{ gap: 12 }}>
          <div className="row">
            <div className="field">
              <label htmlFor="cli">Cliente</label>
              <select id="cli" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.length === 0 ? <option value="">Sem clientes</option> : null}
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {!c.ativo ? '(inativo) ' : ''}
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="data">Data pedido</label>
              <input id="data" type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="prev">Previsão entrega</label>
              <input id="prev" type="date" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                {statusOpções.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pagto">Pagamento</label>
              <select id="pagto" value={pagamentoStatus} onChange={(e) => setPagamentoStatus(e.target.value as PagamentoStatus)}>
                {pagamentoOpcoes.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="peso">Peso total (kg)</label>
              <input id="peso" inputMode="decimal" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
            </div>
            <div className="field" style={{ alignSelf: 'end' }}>
              <label>Forma de cobrança</label>
              <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setModoPreco('kg')}
                  style={{
                    flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: modoPreco === 'kg' ? 'var(--panel)' : 'transparent',
                    color: modoPreco === 'kg' ? 'var(--text-h)' : 'var(--muted)',
                    boxShadow: modoPreco === 'kg' ? 'var(--shadow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Por KG
                </button>
                <button
                  type="button"
                  onClick={() => setModoPreco('fixo')}
                  style={{
                    flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: modoPreco === 'fixo' ? 'var(--panel)' : 'transparent',
                    color: modoPreco === 'fixo' ? 'var(--text-h)' : 'var(--muted)',
                    boxShadow: modoPreco === 'fixo' ? 'var(--shadow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Fixo
                </button>
              </div>
            </div>
          </div>

          <div className="row">
            {modoPreco === 'kg' ? (
              <div className="field">
                <label htmlFor="precoKg">Preço por kg (R$/kg)</label>
                <input id="precoKg" inputMode="decimal" value={precoKg} onChange={(e) => setPrecoKg(e.target.value)} />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="precoFixo">Preço fixo (R$)</label>
                <input id="precoFixo" inputMode="decimal" value={precoFixo} onChange={(e) => setPrecoFixo(e.target.value)} />
              </div>
            )}
            <div className="field" style={{ flex: '2 1 320px', minWidth: '100%' }}>
              <label htmlFor="obs">Observações</label>
              <textarea id="obs" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>

          <section className="panel" style={{ boxShadow: 'none' }}>
            <div className="panelHeader">
              <h3 style={{ fontSize: 15 }}>Peças (escolha o tipo e a quantidade)</h3>
              <button 
                type="button" 
                onClick={adicionarLinhaItem}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px dashed var(--accent)',
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nova peça
              </button>
            </div>
            <div className="panelBody grid" style={{ gap: 10 }}>
              {itensLinhas.map((l) => (
                <div key={l.key} className="row" style={{ gap: 10 }}>
                  <div className="field">
                    <label>Tipo peça</label>
                    <select value={l.tipo_peca_id} onChange={(e) => {
                      const v = e.target.value
                      setItensLinhas((xs) => xs.map((y) => (y.key === l.key ? { ...y, tipo_peca_id: v } : y)))
                    }}>
                      <option value="">Escolha</option>
                      {tipos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Quantidade</label>
                    <input
                      inputMode="numeric"
                      value={l.quantidade}
                      onChange={(e) =>
                        setItensLinhas((xs) =>
                          xs.map((y) => (y.key === l.key ? { ...y, quantidade: e.target.value } : y)),
                        )
                      }
                    />
                  </div>
                  <div className="field" style={{ minWidth: 120, alignSelf: 'end' }}>
                    <label style={{ visibility: 'hidden' }}>X</label>
                    <button 
                      type="button" 
                      onClick={() => removerLinhaItem(l.key)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '42px', padding: '0 16px',
                        borderRadius: 8, border: '1px solid var(--danger)',
                        background: 'transparent',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      title="Remover peça"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {tipos.length === 0 ? (
                <div className="hint">Cadastre os tipos de peça na aba Peças para detalhar os itens do pedido.</div>
              ) : null}
            </div>
          </section>

          <button className="btn btnPrimary" type="button" onClick={() => void salvarPedido()}>
            Salvar pedido
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Pedidos cadastrados</h2>
        </div>
        <div className="panelBody">
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>kg</th>
                  <th>Receita</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th style={{ width: 260 }} />
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td>{p.cliente?.nome ?? '—'}</td>
                    <td>{Number(p.peso_kg).toLocaleString('pt-BR')}</td>
                    <td>{formatBRL(receitaPedido(p))}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="hint">
                      {pagamentoOpcoes.find((o) => o.value === p.pagamento_status)?.label ?? p.pagamento_status}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        {(p.pagamento_status === 'devendo' || p.pagamento_status === 'em_andamento') ? (
                          <button
                            className="btn btnPrimary"
                            type="button"
                            disabled={enviandoId === p.id}
                            onClick={() => void enviarCobranca(p)}
                          >
                            {enviandoId === p.id ? 'Enviando…' : 'Enviar cobrança'}
                          </button>
                        ) : null}
                        <button className="btn" type="button" onClick={() => void preencherEdição(p)}>
                          Editar
                        </button>
                        <button className="btn btnDanger" type="button" onClick={() => void excluir(p)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pedidos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="hint">
                      Nenhum pedido cadastrado ainda.
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
