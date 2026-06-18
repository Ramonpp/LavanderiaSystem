import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchItensPorPedidos,
  fetchPedidos,
  deletePedido,
  updatePedido,
} from '../data/pedidos'
import { fetchClientes } from '../data/clientes'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { Cliente, OrderStatus, PagamentoStatus, PedidoCliente, TipoPeca } from '../types/models'
import { receitaPedido } from '../domain/finance'
import { formatBRL } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'
import { enviarCobrancaWebhook } from '../data/webhook'

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
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tipos, setTipos] = useState<TipoPeca[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [enviandoId, setEnviandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  /* ── Filtros ────────────────────────────────────────── */
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroPagamento, setFiltroPagamento] = useState('todos')
  const [busca, setBusca] = useState('')

  function formatarNomeCliente(c: { nome: string; condominio?: string | null; bloco?: string | null; apartamento?: string | null } | null) {
    if (!c) return '—'
    const parts = []
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
    const termoBusca = busca.toLowerCase().trim()
    return pedidos.filter((p) => {
      if (filtroMes !== 'todos' && p.data_pedido.slice(0, 7) !== filtroMes) return false
      if (filtroPagamento !== 'todos' && p.pagamento_status !== filtroPagamento) return false
      
      if (termoBusca) {
        const nomeCliente = formatarNomeCliente(p.cliente).toLowerCase()
        if (!nomeCliente.includes(termoBusca)) return false
      }
      
      return true
    })
  }, [pedidos, filtroMes, filtroPagamento, busca])

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
  }

  useEffect(() => {
    void reloadAll()
  }, [])

  async function excluir(p: PedidoCliente) {
    if (!window.confirm('Excluir pedido e suas linhas?')) return
    setErro(null)
    const { error } = await deletePedido(p.id)
    if (error) setErro(error)
    else await reloadAll()
  }

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
              {/* Campo de Busca */}
              <div className="field" style={{ minWidth: 200, flex: '1 1 auto' }}>
                <label htmlFor="busca-cliente" style={{ marginBottom: 4 }}>Buscar Cliente</label>
                <input
                  id="busca-cliente"
                  type="text"
                  placeholder="Nome, bloco, ap..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                />
              </div>

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
