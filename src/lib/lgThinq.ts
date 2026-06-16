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

    // De acordo com o openapi.json, o header de país é 'x-country' (ex: 'BR', 'US')
    const headers = {
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'x-message-id': messageId,
      'x-country': 'BR',
      'Authorization': `Bearer ${token}`
    }

    // Usamos o proxy /lg-api configurado no Vercel (ou Vite server) para evitar CORS.
    // O endpoint conforme o openapi.json é: /devices/energy/{deviceId}/usage com period=MONTHLY
    const url = `/lg-api/devices/energy/${deviceId}/usage?period=MONTHLY&startDate=${startDate}&endDate=${endDate}`

    const response = await fetch(url, { headers })

    if (response.status === 401) {
      return { error: 'Acesso negado (401). Verifique se o Token da LG (PAT) expirou ou é inválido.' }
    }

    if (!response.ok) {
      return { error: `Erro na API da LG: ${response.status} ${response.statusText}` }
    }

    const data = await response.json()
    
    // De acordo com o openapi.json (schema energy-usage-res), a resposta tem o formato:
    // {
    //   "response": {
    //     "resultCode": "0000",
    //     "result": {
    //       "property": ["energyUsage"],
    //       "dataList": [
    //         { "usedDate": "202605", "useAmount": 12.3 }
    //       ]
    //     }
    //   }
    // }
    const resultCode = data?.response?.resultCode
    if (resultCode !== '0000') {
      const codeDescriptions: Record<string, string> = {
        '1212': 'Dispositivo não pertence ao usuário (1212)',
        '1221': 'Produto não suportado (1221)',
        '1220': 'Propriedade não suportada (1220)',
        '1307': 'País não suportado (1307)',
        '2214': 'Falha na requisição (2214)',
      }
      const desc = codeDescriptions[resultCode] || `Erro código ${resultCode}`
      return { error: `LG retornou erro: ${desc}` }
    }

    const dataList = data?.response?.result?.dataList
    if (!Array.isArray(dataList)) {
      console.log('Resposta LG sem dataList:', data)
      return { error: 'Formato de resposta inesperado da LG (campo dataList ausente).' }
    }

    // Soma o consumo total de todas as entradas retornadas no período
    let totalWh = 0
    for (const item of dataList) {
      const amount = item.energyUsage ?? item.useAmount
      if (typeof amount === 'number') {
        totalWh += amount
      }
    }

    return { energy_wh: totalWh }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
