import { createClient } from 'npm:@supabase/supabase-js@2'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const normalizar = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
function valor(p: any) { let v = p.preco_fixo ?? Number(p.peso_kg ?? 0) * Number(p.preco_por_kg ?? 0); const d = Number(p.desconto_valor ?? 0); return d > 0 ? (p.desconto_tipo === 'percentual' ? v * (1 - d / 100) : Math.max(0, v - d)) : v }

Deno.serve(async (req) => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN'); const chatId = Deno.env.get('TELEGRAM_CHAT_ID'); const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) return new Response('Não autorizado', { status: 401 })
  const update = await req.json().catch(() => null); const mensagem = update?.message
  if (!mensagem || String(mensagem.chat?.id) !== chatId) return Response.json({ ok: true, ignorado: true })
  const texto = normalizar(String(mensagem.text ?? ''))
  if (!texto.includes('pendencia') && !texto.includes('devendo') && !texto.includes('deve') && !texto.startsWith('/start')) return Response.json({ ok: true, ignorado: true })

  const db = createClient(url!, key!)
  const { data: clientes } = await db.from('cliente').select('id,nome,bloco,apartamento').eq('ativo', true).is('deletado_em', null)
  const ids = (clientes ?? []).map(c => c.id)
  const { data: pedidos } = ids.length ? await db.from('pedido').select('cliente_id,peso_kg,preco_por_kg,preco_fixo,desconto_valor,desconto_tipo').in('cliente_id', ids).neq('pagamento_status', 'pago').neq('status', 'cancelado').is('deletado_em', null) : { data: [] }
  const lista = pedidos ?? []
  const candidatos = (clientes ?? []).filter(cliente => {
    const nome = normalizar(cliente.nome); const primeiroNome = nome.split(/\s+/)[0]
    return nome.length >= 3 && texto.includes(nome) || primeiroNome.length >= 3 && texto.includes(primeiroNome)
  })

  let resposta: string
  if (texto.startsWith('/start')) {
    resposta = '👋 Olá! Pergunte, por exemplo: "Diego está devendo quanto?"\n\nOu envie /pendencias para ver o resumo geral.'
  } else if (candidatos.length === 1) {
    const cliente = candidatos[0]; const pendencias = lista.filter(p => p.cliente_id === cliente.id); const total = pendencias.reduce((s, p) => s + valor(p), 0)
    const local = [cliente.bloco ? `Bl. ${cliente.bloco}` : null, cliente.apartamento ? `Apto ${cliente.apartamento}` : null].filter(Boolean).join(' · ')
    resposta = pendencias.length
      ? `👤 *${cliente.nome}*${local ? ` — ${local}` : ''}\n\n📦 Pedidos pendentes: *${pendencias.length}*\n💰 Total em aberto: *${brl(total)}*`
      : `✅ *${cliente.nome}* não possui pedidos pendentes.`
  } else if (candidatos.length > 1) {
    resposta = `🔎 Encontrei mais de um cliente com esse nome:\n\n${candidatos.map(c => `• ${c.nome}${c.apartamento ? ` — Apto ${c.apartamento}` : ''}`).join('\n')}\n\nEnvie o nome completo para eu consultar.`
  } else {
    const pessoas = new Set(lista.map(p => p.cliente_id)).size; const total = lista.reduce((s, p) => s + valor(p), 0)
    resposta = `📊 *Resumo de devedores*\n\n👥 Pessoas com pendência: *${pessoas}*\n📦 Pedidos pendentes: *${lista.length}*\n💰 Valor total: *${brl(total)}*\n\nPara uma pessoa, pergunte: "Diego está devendo quanto?"`
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: resposta, parse_mode: 'Markdown' }) })
  return Response.json({ ok: true })
})
