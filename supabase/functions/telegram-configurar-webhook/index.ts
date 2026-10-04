Deno.serve(async () => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN'); const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET'); const url = Deno.env.get('SUPABASE_URL')
  if (!token || !secret || !url) return Response.json({ error: 'Secrets do Telegram não configurados.' }, { status: 500 })
  const resposta = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: `${url}/functions/v1/telegram-consulta`, secret_token: secret, allowed_updates: ['message'] }) })
  const corpo = await resposta.json(); return Response.json({ ok: resposta.ok, description: corpo.description ?? null }, { status: resposta.ok ? 200 : 502 })
})
