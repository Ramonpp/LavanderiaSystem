import { createClient } from 'npm:@supabase/supabase-js@2'

type PedidoPendente = {
  cliente_id: string
  peso_kg: number | null
  preco_por_kg: number | null
  preco_fixo: number | null
  desconto_valor: number | null
  desconto_tipo: 'percentual' | 'fixo' | null
}

function valorPedido(pedido: PedidoPendente) {
  let valor = pedido.preco_fixo ?? (Number(pedido.peso_kg ?? 0) * Number(pedido.preco_por_kg ?? 0))
  const desconto = Number(pedido.desconto_valor ?? 0)
  if (desconto > 0) valor = pedido.desconto_tipo === 'percentual'
    ? valor * (1 - desconto / 100)
    : Math.max(0, valor - desconto)
  return valor
}

function brl(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function local(cliente: { bloco: string | null; apartamento: string | null }) {
  return [cliente.bloco ? `Bl. ${cliente.bloco}` : null, cliente.apartamento ? `Apto ${cliente.apartamento}` : null]
    .filter(Boolean)
    .join(' · ')
}

Deno.serve(async () => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!token || !chatId || !url || !serviceRole) {
    return Response.json({ error: 'Configure TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID nos Secrets da Edge Function.' }, { status: 500 })
  }

  const supabase = createClient(url, serviceRole)
  const { data: clientes, error: clientesErro } = await supabase
    .from('cliente')
    .select('id, nome, bloco, apartamento')
    .eq('plano', 'mensal')
    .eq('ativo', true)
    .is('deletado_em', null)
    .order('nome')

  if (clientesErro) return Response.json({ error: clientesErro.message }, { status: 500 })
  const ids = (clientes ?? []).map((cliente) => cliente.id)
  if (ids.length === 0) return Response.json({ ok: true, enviados: 0, motivo: 'Sem mensalistas ativos.' })

  const { data: pedidos, error: pedidosErro } = await supabase
    .from('pedido')
    .select('cliente_id, peso_kg, preco_por_kg, preco_fixo, desconto_valor, desconto_tipo')
    .in('cliente_id', ids)
    .neq('pagamento_status', 'pago')
    .neq('status', 'cancelado')
    .is('deletado_em', null)

  if (pedidosErro) return Response.json({ error: pedidosErro.message }, { status: 500 })

  const porCliente = new Map<string, PedidoPendente[]>()
  ;(pedidos ?? []).forEach((pedido) => porCliente.set(pedido.cliente_id, [...(porCliente.get(pedido.cliente_id) ?? []), pedido]))
  const pendentes = (clientes ?? []).flatMap((cliente) => {
    const lista = porCliente.get(cliente.id) ?? []
    if (lista.length === 0) return []
    return [{ ...cliente, pedidos: lista.length, valor: lista.reduce((total, pedido) => total + valorPedido(pedido), 0) }]
  })

  const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full' }).format(new Date())
  const total = pendentes.reduce((soma, cliente) => soma + cliente.valor, 0)
  const linhas = pendentes.map((cliente) => `• ${cliente.nome}${local(cliente) ? ` — ${local(cliente)}` : ''}\n  ${cliente.pedidos} pedido(s) · ${brl(cliente.valor)}`)
  const texto = pendentes.length === 0
    ? `✅ *Ciclo Novo — Pendências mensais*\n${hoje}\n\nNenhum pagamento mensal pendente.`
    : `📌 *Ciclo Novo — Pendências mensais*\n${hoje}\n\n${linhas.join('\n')}\n\n*Total: ${brl(total)}*`

  const telegram = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto.slice(0, 4096), parse_mode: 'Markdown' }),
  })
  const resposta = await telegram.json()
  if (!telegram.ok) return Response.json({ error: resposta.description ?? 'Falha ao enviar mensagem ao Telegram.' }, { status: 502 })

  return Response.json({ ok: true, mensalistasPendentes: pendentes.length, pedidosPendentes: (pedidos ?? []).length, total })
})
