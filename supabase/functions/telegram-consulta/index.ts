import { createClient } from 'npm:@supabase/supabase-js@2'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
function valor(p: any) { let v = p.preco_fixo ?? Number(p.peso_kg ?? 0) * Number(p.preco_por_kg ?? 0); const d = Number(p.desconto_valor ?? 0); return d > 0 ? (p.desconto_tipo === 'percentual' ? v * (1 - d / 100) : Math.max(0, v - d)) : v }

Deno.serve(async (req) => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN'); const chatId = Deno.env.get('TELEGRAM_CHAT_ID'); const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) return new Response('Não autorizado', { status: 401 })
  const update = await req.json().catch(() => null); const mensagem = update?.message
  if (!mensagem || String(mensagem.chat?.id) !== chatId) return Response.json({ ok: true, ignorado: true })
  const texto = String(mensagem.text ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  if (!texto.includes('pendencia') && !texto.includes('devendo') && !texto.startsWith('/start')) return Response.json({ ok: true, ignorado: true })
  const db = createClient(url!, key!); const { data: clientes } = await db.from('cliente').select('id').eq('ativo', true).is('deletado_em', null)
  const ids = (clientes ?? []).map(c => c.id); const { data: pedidos } = ids.length ? await db.from('pedido').select('cliente_id,peso_kg,preco_por_kg,preco_fixo,desconto_valor,desconto_tipo').in('cliente_id', ids).neq('pagamento_status', 'pago').neq('status', 'cancelado').is('deletado_em', null) : { data: [] }
  const lista = pedidos ?? []; const pessoas = new Set(lista.map(p => p.cliente_id)).size; const total = lista.reduce((s, p) => s + valor(p), 0)
  const resposta = texto.startsWith('/start') ? '👋 Olá! Envie /pendencias para ver quantas pessoas estão devendo e o valor total.' : `📊 *Resumo de devedores*\n\n👥 Pessoas com pendência: *${pessoas}*\n📦 Pedidos pendentes: *${lista.length}*\n💰 Valor total: *${brl(total)}*`
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: resposta, parse_mode: 'Markdown' }) })
  return Response.json({ ok: true })
})
