import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
  { nome: 'Toalha de piso', quantidade: '1' },
  { nome: 'Toalha de banho', quantidade: '2' },
  { nome: 'Toalha de rosto', quantidade: '1' },
  { nome: 'Lencol casal', quantidade: '1' },
  { nome: 'Fronha', quantidade: '2' },
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

const STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  recebido: 'badgeBlue',
  em_lavagem: 'badgeYellow',
  pronto: 'badgeGreen',
  entregue: 'badgeMuted',
  cancelado: 'badgeRed',
}

const PAGAMENTO_BADGE_CLASSES: Record<PagamentoStatus, string> = {
  pago: 'badgeGreen',
  devendo: 'badgeRed',
  em_andamento: 'badgeYellow',
}

export function PedidosCadastradosPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tipos, setTipos] = useState<TipoPeca[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [dataPedido, setDataPedido] = useState(() => new Date().toISOString().slice(0, 10))
  const [dataPrev, setDataPrev] = useState('')
  const [status, setStatus] = useState<OrderStatus>('recebido')
  const [pagamentoStatus, setPagamentoStatus] = useState<PagamentoStatus>('devendo')
  const [pesoKg, setPesoKg] = useState('')

  type PricingMode = 'kg' | 'fixo'
  const [modoPreco, setModoPreco] = useState<PricingMode>('kg')
  const [precoKg, setPrecoKg] = useState('15')
  const [precoFixo, setPrecoFixo] = useState('')

  const [observacoes, setObservacoes] = useState('')

  const [itensLinhas, setItensLinhas] = useState<ItemLinha[]>([])

  /* ── Filtros ────────────────────────────────────────── */
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroPagamento, setFiltroPagamento] = useState('todos')

  function formatarNomeCliente(c: { nome: string; condominio?: string | null; bloco?: string | null; apartamento?: string | null } | null) {
    if (!c) return '—'
    const parts = []
    if (c.condominio?.trim()) parts.push(c.condominio.trim())
    if (c.apartamento?.trim()) parts.push(c.apartamento.trim())
    if (c.bloco?.trim()) parts.push(c.bloco.trim())
    return parts.length > 0 ? `${c.nome} (${parts.join(' ')})` : c.nome
  }

  const mesesDisponiveis = useMemo(() => {
    const list = pedidos.map((p) => p.data_pedido.slice(0, 7))
    const unique = Array.from(new Set(list)).sort().reverse()
    return unique
  }, [pedidos])

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (filtroMes !== 'todos' && p.data_pedido.slice(0, 7) !== filtroMes) return false
      if (filtroPagamento !== 'todos' && p.pagamento_status !== filtroPagamento) return false
      return true
    })
  }, [pedidos, filtroMes, filtroPagamento])

  /* ── Atualizações Inline ──────────────────────────────── */
  async function inlineUpdateStatus(id: string, newStatus: OrderStatus) {
    setErro(null)
    setMsg(null)
    const { error } = await updatePedido(id, { status: newStatus })
    if (error) setErro(error)
    else {
      setMsg('Status do pedido atualizado.')
      await reloadAll()
    }
  }

  async function inlineUpdatePagamento(id: string, newPagamento: PagamentoStatus) {
    setErro(null)
    setMsg(null)
    const { error } = await updatePedido(id, { pagamento_status: newPagamento })
    if (error) setErro(error)
    else {
      setMsg('Status de pagamento atualizado.')
      await reloadAll()
    }
  }

  const primeiraPecaDisponível = useMemo(() => tipos[0]?.id ?? '', [tipos])
  const DEFAULT_PRECO_POR_KG_48H = '15'

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
    setPrecoKg('15')
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

  useEffect(() => {
    if (location.hash === '#criar') {
      if (editandoId) {
        limparForm()
      }
      const el = document.getElementById('criar-pedido')
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 50)
      }
    } else if (location.hash === '#lista') {
      const el = document.getElementById('pedidos-cadastrados')
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 50)
      }
    }
  }, [location.hash, location.key])

  async function enviarCobranca(p: PedidoCliente) {
    setConfirmandoId(null)
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

      const valor = receitaPedido(p)
      const nomeCompleto = p.cliente?.nome ?? cli?.nome ?? 'Cliente'
      const primeiroNome = nomeCompleto.trim().split(' ')[0]
      const pesoStr = p.peso_kg != null ? `${Number(p.peso_kg).toLocaleString('pt-BR')} kg` : '—'

      const [ano, mes, dia] = p.data_pedido.split('-')
      const dataFormatada = `${dia}/${mes}/${ano}`

      const texto = `Olá ${primeiroNome}, tudo bem?\n\n` +
        `Seu enxoval já foi coletado, tratado com todo carinho e está em processo de entrega.\n` +
        `Segue a imagem da comanda com a quantidade de itens, peso total e valor do serviço.\n\n` +
        `🧺 *Peso total:* ${pesoStr}\n` +
        `💰 *Valor:* ${formatBRL(valor)}\n\n` +
        `Estamos enviando a chave pix na mensagem abaixo.  \n` +
        `Caso prefira outra forma de pagamento, é só nos informar.\n` +
        `Qualquer dúvida, estamos à disposição!\n\n` +
        `Abraços, equipe Ciclo Novo Lavanderia 💙`

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
          data_pedido: dataFormatada,
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
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Pedidos cadastrados</h1>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel" id="pedidos-cadastrados" style={{ marginTop: 24 }}>
        <div className="panelHeader" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, color: 'var(--accent)' }}>Pedidos cadastrados</h2>
        </div>
        <div className="panelBody" style={{ paddingTop: 0 }}>
          {/* Filtros */}
          <div className="row" style={{ marginBottom: 14, gap: 12, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Filtro Mês */}
              <div className="field" style={{ minWidth: 160, flex: '0 1 auto' }}>
                <label htmlFor="filtro-mes" style={{ marginBottom: 4 }}>Filtrar por Mês</label>
                <select
                  id="filtro-mes"
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8 }}
                >
                  <option value="todos">Todos os meses</option>
                  {mesesDisponiveis.map((m) => {
                    const [ano, mes] = m.split('-')
                    const mesesNomes = [
                      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                    ]
                    const nomeFormatado = `${mesesNomes[parseInt(mes, 10) - 1]} de ${ano}`
                    return (
                      <option key={m} value={m}>
                        {nomeFormatado}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Filtro Pagamento */}
              <div className="field" style={{ minWidth: 280, flex: '0 1 auto' }}>
                <label style={{ marginBottom: 4 }}>Filtrar por Pagamento</label>
                <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
                  {[
                    { value: 'todos', label: 'Todos' },
                    { value: 'pago', label: 'Pago' },
                    { value: 'devendo', label: 'Devendo' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFiltroPagamento(opt.value)}
                      style={{
                        flex: 1, padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        background: filtroPagamento === opt.value ? 'var(--panel)' : 'transparent',
                        color: filtroPagamento === opt.value ? 'var(--text-h)' : 'var(--muted)',
                        boxShadow: filtroPagamento === opt.value ? 'var(--shadow)' : 'none',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hint" style={{ fontWeight: 600 }}>
              {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido encontrado' : 'pedidos encontrados'}
            </div>
          </div>

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
                {pedidosFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>
                        {formatarNomeCliente(p.cliente)}
                      </div>
                    </td>
                    <td>{Number(p.peso_kg).toLocaleString('pt-BR')}</td>
                    <td>{formatBRL(receitaPedido(p))}</td>
                    <td>
                      <select
                        value={p.status}
                        onChange={(e) => void inlineUpdateStatus(p.id, e.target.value as OrderStatus)}
                        className={`badge-select ${STATUS_BADGE_CLASSES[p.status]}`}
                        title="Clique para alterar status"
                      >
                        {statusOpções.map((s) => (
                          <option key={s} value={s}>
                            {s.replaceAll('_', ' ').replace(/^./, str => str.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={p.pagamento_status ?? 'devendo'}
                        onChange={(e) => void inlineUpdatePagamento(p.id, e.target.value as PagamentoStatus)}
                        className={`badge-select ${PAGAMENTO_BADGE_CLASSES[p.pagamento_status ?? 'devendo']}`}
                        title="Clique para alterar pagamento"
                      >
                        {pagamentoOpcoes.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        {(p.pagamento_status === 'devendo' || p.pagamento_status === 'em_andamento') ? (
                          confirmandoId === p.id ? (
                            <div className="row" style={{ gap: 4 }}>
                              <button
                                className="btn btnSuccess btnIcon"
                                type="button"
                                disabled={enviandoId === p.id}
                                onClick={() => void enviarCobranca(p)}
                                title="Confirmar enviar mensagem"
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </button>
                              <button
                                className="btn btnIcon"
                                type="button"
                                onClick={() => setConfirmandoId(null)}
                                title="Cancelar envio"
                              >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btnPrimary btnIcon"
                              type="button"
                              disabled={enviandoId === p.id}
                              onClick={() => setConfirmandoId(p.id)}
                              title="Enviar cobrança pelo Whatsapp"
                            >
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                            </button>
                          )
                        ) : null}
                        <button className="btn btnIcon" type="button" onClick={() => navigate(`/pedidos/criar?edit=${p.id}`)} title="Editar pedido">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn btnDanger btnIcon" type="button" onClick={() => void excluir(p)} title="Excluir pedido">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
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
