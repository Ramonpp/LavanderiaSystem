import { useEffect, useMemo, useState } from 'react'
import { fetchPedidos } from '../data/pedidos'
import {
  atualizarPermissaoWhatsapp,
  fetchPagamentos,
  registrarCobranca,
  registrarPagamento,
} from '../data/financeiro'
import { receitaPedido } from '../domain/finance'
import { formatBRL } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'
import type { ClienteFormaPagamento, Pagamento, PedidoCliente } from '../types/models'
import { supabase } from '../lib/supabase'

type ClienteCobranca = {
  id: string
  nome: string
  telefone: string | null
  condominio: string | null
  bloco: string | null
  apartamento: string | null
  forma_pagamento: ClienteFormaPagamento
  whatsapp_opt_in: boolean
  cobranca_pausada: boolean
  ultima_cobranca_em: string | null
  pedidos: Array<PedidoCliente & { total: number; pago: number; saldo: number }>
  total: number
}

function telefoneWhatsapp(valor: string | null) {
  const numeros = (valor ?? '').replace(/\D/g, '')
  if (!numeros) return ''
  return numeros.startsWith('55') ? numeros : `55${numeros}`
}

function dataBR(valor: string) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

export function CobrancasPage() {
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [clientesInfo, setClientesInfo] = useState<Record<string, Omit<ClienteCobranca, 'pedidos' | 'total'>>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [pagandoPedido, setPagandoPedido] = useState<string | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<ClienteFormaPagamento>('pix')
  const [salvando, setSalvando] = useState(false)

  async function recarregar() {
    setErro(null)
    const { data: pedidosData, error: pedidosError } = await fetchPedidos()
    if (pedidosError) {
      setErro(pedidosError)
      return
    }
    const pendentes = pedidosData.filter((p) => p.status !== 'cancelado' && p.pagamento_status !== 'pago')
    if (pendentes.length === 0) {
      setPedidos([])
      setPagamentos([])
      setClientesInfo({})
      return
    }
    const [{ data: pagamentosData, error: pagamentosError }, { data: clientes, error: clientesError }] = await Promise.all([
      fetchPagamentos(pendentes.map((p) => p.id)),
      supabase
        .from('cliente')
        .select('id,nome,telefone,condominio,bloco,apartamento,forma_pagamento,whatsapp_opt_in,cobranca_pausada,ultima_cobranca_em')
        .in('id', [...new Set(pendentes.map((p) => p.cliente_id))]),
    ])
    if (pagamentosError) setErro(pagamentosError)
    if (clientesError) setErro(clientesError.message)
    setPedidos(pendentes)
    setPagamentos(pagamentosData)
    setClientesInfo(Object.fromEntries((clientes ?? []).map((c) => [c.id, {
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      condominio: c.condominio,
      bloco: c.bloco,
      apartamento: c.apartamento,
      forma_pagamento: c.forma_pagamento,
      whatsapp_opt_in: Boolean(c.whatsapp_opt_in),
      cobranca_pausada: Boolean(c.cobranca_pausada),
      ultima_cobranca_em: c.ultima_cobranca_em,
    }])))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void recarregar() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const clientes = useMemo(() => {
    const pagosPorPedido = new Map<string, number>()
    pagamentos.forEach((p) => pagosPorPedido.set(p.pedido_id, (pagosPorPedido.get(p.pedido_id) ?? 0) + Number(p.valor)))
    const grupos = new Map<string, ClienteCobranca>()

    pedidos.forEach((pedido) => {
      const info = clientesInfo[pedido.cliente_id]
      if (!info) return
      const total = receitaPedido(pedido)
      const pago = pagosPorPedido.get(pedido.id) ?? 0
      const saldo = Math.max(0, total - pago)
      if (saldo <= 0) return
      const atual = grupos.get(info.id) ?? { ...info, pedidos: [], total: 0 }
      atual.pedidos.push({ ...pedido, total, pago, saldo })
      atual.total += saldo
      grupos.set(info.id, atual)
    })

    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return [...grupos.values()]
      .filter((c) => !termo || [c.nome, c.telefone, c.condominio, c.bloco, c.apartamento]
        .some((valor) => (valor ?? '').toLocaleLowerCase('pt-BR').includes(termo)))
      .sort((a, b) => b.total - a.total)
  }, [busca, clientesInfo, pagamentos, pedidos])

  const totalAberto = clientes.reduce((soma, cliente) => soma + cliente.total, 0)

  function mensagemCobranca(cliente: ClienteCobranca) {
    const itens = cliente.pedidos
      .map((p) => `pedido de ${dataBR(p.data_pedido)}: ${formatBRL(p.saldo)}`)
      .join('; ')
    const local = [cliente.condominio, cliente.bloco ? `Bloco ${cliente.bloco}` : null, cliente.apartamento ? `Apto ${cliente.apartamento}` : null].filter(Boolean).join(' · ')
    return `Olá, ${cliente.nome}. Tudo bem?${local ? ` Referente a ${local}.` : ''} Identificamos ${itens}. O saldo em aberto é ${formatBRL(cliente.total)}. Se já realizou o pagamento, por favor desconsidere e nos envie o comprovante. Obrigado!`
  }

  function abrirPagamento(cliente: ClienteCobranca, pedidoId: string, saldo: number) {
    setPagandoPedido(pedidoId)
    setValorPagamento(saldo.toFixed(2).replace('.', ','))
    setFormaPagamento(cliente.forma_pagamento)
    setMsg(null)
  }

  async function salvarPagamento() {
    if (!pagandoPedido) return
    const valor = Number(valorPagamento.replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor de pagamento válido.')
      return
    }
    setSalvando(true)
    setErro(null)
    const { error } = await registrarPagamento({ pedidoId: pagandoPedido, valor, forma: formaPagamento })
    setSalvando(false)
    if (error) {
      setErro(error)
      return
    }
    setPagandoPedido(null)
    setMsg('Pagamento registrado e saldo atualizado.')
    await recarregar()
  }

  async function marcarCobranca(cliente: ClienteCobranca) {
    setErro(null)
    const { error } = await registrarCobranca({
      clienteId: cliente.id,
      pedidoId: cliente.pedidos.length === 1 ? cliente.pedidos[0].id : undefined,
      mensagem: mensagemCobranca(cliente),
    })
    if (error) setErro(error)
    else {
      setMsg(`Cobrança de ${cliente.nome} registrada no histórico.`)
      await recarregar()
    }
  }

  async function alternarOptIn(cliente: ClienteCobranca) {
    setErro(null)
    const { error } = await atualizarPermissaoWhatsapp(cliente.id, !cliente.whatsapp_opt_in)
    if (error) setErro(error)
    else await recarregar()
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Cobranças e recebimentos</h1>
          <div className="hint">Envio manual pelo WhatsApp, somente com autorização registrada.</div>
        </div>
        <button className="btn" type="button" onClick={() => void recarregar()}>Atualizar</button>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelBody row" style={{ alignItems: 'center' }}>
          <div style={{ minWidth: 180 }}>
            <div className="hint">Saldo total em aberto</div>
            <strong style={{ display: 'block', color: 'var(--text-h)', fontSize: 24 }}>{formatBRL(totalAberto)}</strong>
          </div>
          <div style={{ minWidth: 140 }}>
            <div className="hint">Clientes pendentes</div>
            <strong style={{ color: 'var(--text-h)', fontSize: 24 }}>{clientes.length}</strong>
          </div>
          <div className="field" style={{ marginLeft: 'auto', maxWidth: 360 }}>
            <label htmlFor="busca-cobranca">Buscar cliente</label>
            <input id="busca-cobranca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, condomínio, bloco ou apartamento" />
          </div>
        </div>
      </section>

      {clientes.map((cliente) => {
        const telefone = telefoneWhatsapp(cliente.telefone)
        const mensagem = mensagemCobranca(cliente)
        const podeEnviar = Boolean(telefone && cliente.whatsapp_opt_in && !cliente.cobranca_pausada)
        return (
          <section className="panel" key={cliente.id}>
            <div className="panelHeader" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: 17 }}>{cliente.nome}</h2>
                <div style={{ color: 'var(--text-h)', fontWeight: 600, marginTop: 3 }}>
                  {[cliente.condominio, cliente.bloco ? `Bloco ${cliente.bloco}` : null, cliente.apartamento ? `Apto ${cliente.apartamento}` : null].filter(Boolean).join(' · ') || 'Localização não cadastrada'}
                </div>
                <div className="hint">{cliente.telefone || 'Telefone não cadastrado'} · {cliente.pedidos.length} pedido(s)</div>
              </div>
              <strong style={{ color: 'var(--danger)', fontSize: 18 }}>{formatBRL(cliente.total)}</strong>
            </div>
            <div className="panelBody grid">
              <div className="tableWrap desktop-only">
                <table>
                  <thead><tr><th>Pedido</th><th>Valor</th><th>Recebido</th><th>Saldo</th><th>Ação</th></tr></thead>
                  <tbody>
                    {cliente.pedidos.map((pedido) => (
                      <tr key={pedido.id}>
                        <td>{dataBR(pedido.data_pedido)}</td>
                        <td>{formatBRL(pedido.total)}</td>
                        <td>{formatBRL(pedido.pago)}</td>
                        <td><strong>{formatBRL(pedido.saldo)}</strong></td>
                        <td><button className="btn btnPrimary" type="button" onClick={() => abrirPagamento(cliente, pedido.id, pedido.saldo)}>Registrar pagamento</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mobile-card-list mobile-only">
                {cliente.pedidos.map((pedido) => (
                  <div className="mobile-card" key={pedido.id}>
                    <div className="mobile-card-header"><strong>{dataBR(pedido.data_pedido)}</strong><strong>{formatBRL(pedido.saldo)}</strong></div>
                    <div className="hint">Total {formatBRL(pedido.total)} · recebido {formatBRL(pedido.pago)}</div>
                    <button className="btn btnPrimary" type="button" onClick={() => abrirPagamento(cliente, pedido.id, pedido.saldo)}>Registrar pagamento</button>
                  </div>
                ))}
              </div>

              {pagandoPedido && cliente.pedidos.some((p) => p.id === pagandoPedido) ? (
                <div className="row" style={{ padding: 12, border: '1px solid var(--accent-border)', borderRadius: 12, background: 'var(--accent-bg)' }}>
                  <div className="field"><label>Valor recebido</label><input value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)} inputMode="decimal" /></div>
                  <div className="field"><label>Forma</label><select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value as ClienteFormaPagamento)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select></div>
                  <button className="btn btnPrimary" type="button" disabled={salvando} onClick={() => void salvarPagamento()}>{salvando ? 'Salvando…' : 'Confirmar'}</button>
                  <button className="btn" type="button" onClick={() => setPagandoPedido(null)}>Cancelar</button>
                </div>
              ) : null}

              <div className="row" style={{ alignItems: 'center' }}>
                <button className="btn" type="button" onClick={() => void alternarOptIn(cliente)}>
                  {cliente.whatsapp_opt_in ? '✓ WhatsApp autorizado' : 'Registrar autorização do WhatsApp'}
                </button>
                <a
                  className={`btn${podeEnviar ? ' btnSuccess' : ''}`}
                  href={podeEnviar ? `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!podeEnviar}
                  style={!podeEnviar ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                >Abrir WhatsApp</a>
                <button className="btn" type="button" disabled={!podeEnviar} onClick={() => void marcarCobranca(cliente)}>Marcar como enviada</button>
                <span className="hint">
                  {!telefone ? 'Cadastre um telefone para cobrar.' : !cliente.whatsapp_opt_in ? 'Confirme a autorização antes do envio.' : cliente.ultima_cobranca_em ? `Última cobrança: ${new Date(cliente.ultima_cobranca_em).toLocaleString('pt-BR')}` : 'Nenhuma cobrança registrada.'}
                </span>
              </div>
            </div>
          </section>
        )
      })}

      {clientes.length === 0 ? <section className="panel"><div className="panelBody hint">Nenhuma pendência encontrada.</div></section> : null}
    </div>
  )
}
