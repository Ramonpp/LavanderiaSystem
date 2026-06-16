export async function fetchLgEnergyUsage(
  deviceId: string,
  startDate: string,
  endDate: string
): Promise<{ energy_wh?: number; error?: string }> {
  try {
    const clientId = import.meta.env.VITE_LG_CLIENT_ID
    const apiKey = import.meta.env.VITE_LG_API_KEY
    const messageId = import.meta.env.VITE_LG_MESSAGE_ID
    const token = import.meta.env.VITE_LG_TOKEN

    if (!clientId || !apiKey || !messageId || !token) {
      return { error: 'Credenciais da LG ThinQ não configuradas.' }
    }

    const headers = {
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'x-message-id': messageId,
      'x-country-code': 'BR',
      'x-service-phase': 'OP',
      'Authorization': `Bearer ${token}`
    }

    // Usamos o proxy /lg-api configurado no Vercel (ou Vite server) para evitar CORS
    const url = `/lg-api/devices/energy/${deviceId}/usage?period=MONTHLY&startDate=${startDate}&endDate=${endDate}`

    const response = await fetch(url, { headers })

    if (response.status === 401) {
      return { error: 'Acesso negado (401). Verifique se o Token da LG expirou.' }
    }

    if (!response.ok) {
      return { error: `Erro na API da LG: ${response.status} ${response.statusText}` }
    }

    const data = await response.json()
    
    // Supondo que a resposta venha no formato { item: { totalUsage: 1234 } } (em Watt-hora)
    // Se a estrutura for diferente, isso precisará ser ajustado.
    // Vamos tentar pegar de item.totalUsage ou de outro lugar genérico.
    let totalWh = 0
    
    if (data && data.item && typeof data.item.totalUsage === 'number') {
      totalWh = data.item.totalUsage
    } else if (data && typeof data.totalUsage === 'number') {
      totalWh = data.totalUsage
    } else {
      // Se não soubermos a estrutura, retornamos o JSON no erro para debug
      console.log('Resposta LG:', data)
      return { error: 'Formato de resposta inesperado da LG. Olhe o console.' }
    }

    return { energy_wh: totalWh }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
