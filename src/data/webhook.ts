import { fetchAppConfig } from './appConfig'

export type WebhookCobrancaPayload = {
  type: 'cobranca'
  cliente: {
    id: string
    nome: string
    telefone: string | null
    email: string | null
    plano?: string
    forma_pagamento?: string
  }
  pedido: {
    id: string
    data_pedido: string
    status: string
    pagamento_status: string
    valor: number
  }
  itens: Array<{ nome: string; quantidade: number }>
  texto: string
}

export async function enviarCobrancaWebhook(payload: WebhookCobrancaPayload): Promise<{ error: string | null }> {
  const { data: cfg, error } = await fetchAppConfig()
  if (error) return { error }
  const url = cfg?.webhook_url ?? null
  if (!url) return { error: 'Webhook não configurado. Vá em Config > Webhook e salve a URL.' }

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resp.ok) return { error: `Webhook retornou ${resp.status}.` }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Falha ao enviar webhook.' }
  }
}

