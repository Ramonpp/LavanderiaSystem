import { createClient } from 'npm:@supabase/supabase-js@2'

type Pedido = { cliente_id: string; data_pedido: string; peso_kg: number | null; preco_por_kg: number | null; preco_fixo: number | null; desconto_valor: number | null; desconto_tipo: 'percentual' | 'fixo' | null }

function valor(p: Pedido) {
  let total = p.preco_fixo ?? Number(p.peso_kg ?? 0) * Number(p.preco_por_kg ?? 0)
  const desconto = Number(p.desconto_valor ?? 0)
  return desconto > 0 ? (p.desconto_tipo === 'percentual' ? total * (1 - desconto / 100) : Math.max(0, total - desconto)) : total
}
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function periodoMesPassado() {
  const agora = new Date()
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(agora)
  const ano = Number(partes.find(x => x.type === 'year')?.value); const mes = Number(partes.find(x => x.type === 'month')?.value)
  const inicio = new Date(Date.UTC(ano, mes - 2, 1)); const fim = new Date(Date.UTC(ano, mes - 1, 0))
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10), titulo: inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}

function formatarSecao(icone: string, titulo: string, clientes: Array<{ nome: string; bloco: string | null; apartamento: string | null; pedidos: Pedido[] }>) {
  const total = clientes.reduce((s, c) => s + c.pedidos.reduce((x, p) => x + valor(p), 0), 0)
  if (!clientes.length) return `${icone} *${titulo}*\n✅ Nenhuma pendência.`
  const linhas = clientes.map(c => {
    const local = [c.bloco ? `Bl. ${c.bloco}` : null, c.apartamento ? `Apto ${c.apartamento}` : null].filter(Boolean).join(' · ')
    return `• *${c.nome}*${local ? ` — ${local}` : ''}\n  ${c.pedidos.length} pedido(s) · *${brl(c.pedidos.reduce((s, p) => s + valor(p), 0))}*`
  })
  return `${icone} *${titulo}*\n${linhas.join('\n\n')}\n\nSubtotal: *${brl(total)}*`
}

Deno.serve(async (req) => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN'); const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!token || !chatId || !url || !key) return Response.json({ error: 'Secrets do Telegram não configurados.' }, { status: 500 })
  const db = createClient(url, key)
  const chaveRecebida = req.headers.get('x-telegram-cron-key')
  const { data: automacao, error: erroAutomacao } = await db.from('telegram_automacao').select('chave_cron').eq('id', true).maybeSingle()
  if (erroAutomacao || !automacao || chaveRecebida !== automacao.chave_cron) return new Response('Não autorizado', { status: 401 })
  const corpo = await req.json().catch(() => ({})) as { modo?: string }
  const fimDeMes = corpo.modo === 'fim_mes'
  if (fimDeMes) {
    const agora = new Date(); const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000)
    const mesAtual = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit' }).format(agora)
    const mesAmanha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit' }).format(amanha)
    if (mesAtual === mesAmanha) return Response.json({ ok: true, enviado: false, motivo: 'Não é o último dia do mês.' })
  }
  const periodo = periodoMesPassado()
  const { data: clientes, error: erroClientes } = await db.from('cliente').select('id,nome,bloco,apartamento,plano').in('plano', ['pagou', 'mensal']).eq('ativo', true).is('deletado_em', null).order('nome')
  if (erroClientes) return Response.json({ error: erroClientes.message }, { status: 500 })
  const ids = (clientes ?? []).map(c => c.id); if (!ids.length) return Response.json({ ok: true, motivo: 'Sem clientes.' })
  const { data: pedidos, error: erroPedidos } = await db.from('pedido').select('cliente_id,data_pedido,peso_kg,preco_por_kg,preco_fixo,desconto_valor,desconto_tipo').in('cliente_id', ids).neq('pagamento_status', 'pago').neq('status', 'cancelado').is('deletado_em', null)
  if (erroPedidos) return Response.json({ error: erroPedidos.message }, { status: 500 })
  const porCliente = new Map<string, Pedido[]>(); (pedidos ?? []).forEach(p => porCliente.set(p.cliente_id, [...(porCliente.get(p.cliente_id) ?? []), p as Pedido]))
  const usouPagou = (clientes ?? []).filter(c => c.plano === 'pagou').flatMap(c => { const lista = porCliente.get(c.id) ?? []; return lista.length ? [{ ...c, pedidos: lista }] : [] })
  const mensalistas = (clientes ?? []).filter(c => c.plano === 'mensal').flatMap(c => {
    const lista = porCliente.get(c.id) ?? []
    const selecionados = fimDeMes ? lista : lista.filter(p => p.data_pedido >= periodo.inicio && p.data_pedido <= periodo.fim)
    return selecionados.length ? [{ ...c, pedidos: selecionados }] : []
  })
  const total = [...usouPagou, ...mensalistas].reduce((s, c) => s + c.pedidos.reduce((x, p) => x + valor(p), 0), 0)
  const texto = fimDeMes
    ? `📅 *Ciclo Novo — Fechamento mensal*\n\n${formatarSecao('👥', 'Mensalistas devedores', mensalistas)}\n\n💰 *Total mensalista em aberto: ${brl(total)}*\n\nResponda /pendencias para consultar o resumo geral.`
    : `📣 *Ciclo Novo — Fechamento de sexta*\n\n${formatarSecao('🧺', 'Usou e Pagou — pendências atuais', usouPagou)}\n\n${formatarSecao('📅', `Mensalistas — ${periodo.titulo}`, mensalistas)}\n\n💰 *Total geral: ${brl(total)}*\n\nResponda /pendencias para consultar o resumo geral.`
  const resposta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: texto.slice(0, 4096), parse_mode: 'Markdown' }) })
  if (!resposta.ok) return Response.json({ error: (await resposta.json()).description ?? 'Falha no Telegram.' }, { status: 502 })
  return Response.json({ ok: true, usouPagou: usouPagou.length, mensalistas: mensalistas.length, total })
})
