import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Maquina = { id: string; nome: string; device_id: string }
type EstadoLg = {
  maquina_id: string
  ultimo_estado: string | null
  ciclo_em_andamento: boolean
  ciclo_iniciado_em: string | null
}

const estadosParados = new Set(['INITIAL', 'POWER_OFF', 'END', 'PAUSE', 'ERROR', 'RESERVED', 'STANDBY'])
const estadosFinais = new Set(['END', 'POWER_OFF', 'INITIAL'])

function dataSaoPaulo(offsetDias = 0) {
  const agora = new Date(Date.now() + offsetDias * 86_400_000)
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(agora)
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value ?? ''
  return `${valor('year')}${valor('month')}${valor('day')}`
}

function encontrarEstado(valor: unknown): string | null {
  if (!valor || typeof valor !== 'object') return null
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const estado = encontrarEstado(item)
      if (estado) return estado
    }
    return null
  }
  const objeto = valor as Record<string, unknown>
  if (typeof objeto.currentState === 'string') return objeto.currentState
  for (const item of Object.values(objeto)) {
    const estado = encontrarEstado(item)
    if (estado) return estado
  }
  return null
}

function credenciaisLg() {
  return {
    clientId: Deno.env.get('LG_CLIENT_ID') ?? Deno.env.get('VITE_LG_CLIENT_ID'),
    apiKey: Deno.env.get('LG_API_KEY') ?? Deno.env.get('VITE_LG_API_KEY'),
    token: Deno.env.get('LG_TOKEN') ?? Deno.env.get('VITE_LG_TOKEN'),
  }
}

async function chamarLg(caminho: string) {
  const { clientId, apiKey, token } = credenciaisLg()
  if (!clientId || !apiKey || !token) throw new Error('Credenciais da LG ThinQ não configuradas no backend.')
  const resposta = await fetch(`https://api-aic.lgthinq.com${caminho}`, {
    headers: {
      'x-client-id': clientId,
      'x-api-key': apiKey,
      'x-message-id': crypto.randomUUID(),
      'x-country': 'BR',
      Authorization: `Bearer ${token}`,
    },
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(`LG ThinQ respondeu ${resposta.status}.`)
  const codigo = corpo?.response?.resultCode
  if (codigo && codigo !== '0000') throw new Error(`LG ThinQ retornou o código ${codigo}.`)
  return corpo
}

async function autorizado(req: Request, db: ReturnType<typeof createClient>) {
  const { data: config } = await db.from('lg_automacao').select('chave_cron').eq('id', true).maybeSingle()
  if (config?.chave_cron && req.headers.get('x-lg-cron-key') === config.chave_cron) return true

  const authorization = req.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data: usuario, error } = await db.auth.getUser(token)
  if (error || !usuario.user) return false

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const clienteUsuario = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
  const { data: maquinas, error: erroAcesso } = await clienteUsuario.from('maquina').select('id').limit(1)
  return !erroAcesso && Boolean(maquinas?.length)
}

async function sincronizarEstado(db: ReturnType<typeof createClient>, maquina: Maquina) {
  const agora = new Date().toISOString()
  try {
    const corpo = await chamarLg(`/devices/${maquina.device_id}/state`)
    const estado = encontrarEstado(corpo?.response)
    if (!estado) throw new Error('Estado atual não encontrado na resposta da LG.')

    const { data: anterior } = await db.from('maquina_estado_lg')
      .select('maquina_id,ultimo_estado,ciclo_em_andamento,ciclo_iniciado_em')
      .eq('maquina_id', maquina.id).maybeSingle() as { data: EstadoLg | null }

    const executando = !estadosParados.has(estado)
    let cicloEmAndamento = anterior?.ciclo_em_andamento ?? false
    let cicloIniciadoEm = anterior?.ciclo_iniciado_em ?? null
    let cicloRegistrado = false

    if (executando && !cicloEmAndamento) {
      cicloEmAndamento = true
      cicloIniciadoEm = agora
    } else if (cicloEmAndamento && estadosFinais.has(estado) && cicloIniciadoEm) {
      const { data, error } = await db.rpc('registrar_ciclo_lg', {
        p_maquina_id: maquina.id,
        p_iniciado_em: cicloIniciadoEm,
        p_finalizado_em: agora,
        p_estado_final: estado,
      })
      if (error) throw error
      cicloRegistrado = data === true
      cicloEmAndamento = false
      cicloIniciadoEm = null
    }

    const { error: erroEstado } = await db.from('maquina_estado_lg').upsert({
      maquina_id: maquina.id,
      ultimo_estado: estado,
      ciclo_em_andamento: cicloEmAndamento,
      ciclo_iniciado_em: cicloIniciadoEm,
      ultima_sincronizacao_em: agora,
      ultimo_erro: null,
      atualizado_em: agora,
    }, { onConflict: 'maquina_id' })
    if (erroEstado) throw erroEstado
    return { maquina: maquina.nome, estado, ciclo_registrado: cicloRegistrado }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    await db.from('maquina_estado_lg').upsert({
      maquina_id: maquina.id, ultima_sincronizacao_em: agora, ultimo_erro: mensagem, atualizado_em: agora,
    }, { onConflict: 'maquina_id' })
    return { maquina: maquina.nome, erro: mensagem }
  }
}

async function sincronizarConsumo(
  db: ReturnType<typeof createClient>, maquina: Maquina, inicioInformado?: string, fimInformado?: string,
) {
  try {
    const consultaMensal = Boolean(inicioInformado && /^\d{6}$/.test(inicioInformado))
    const ontem = dataSaoPaulo(-1)
    const inicio = inicioInformado ?? `${ontem.slice(0, 6)}01`
    const fim = fimInformado ?? ontem
    const periodo = consultaMensal ? 'MONTHLY' : 'DAILY'
    const corpo = await chamarLg(
      `/devices/energy/${maquina.device_id}/usage?period=${periodo}&startDate=${inicio}&endDate=${fim}`,
    )
    const lista = corpo?.response?.result?.dataList
    if (!Array.isArray(lista)) throw new Error('A LG não retornou a lista de consumo.')
    const totalWh = lista.reduce((soma: number, item: Record<string, unknown>) => {
      const valor = Number(item.useAmount ?? item.energyUsage ?? 0)
      return soma + (Number.isFinite(valor) ? valor : 0)
    }, 0)
    const mesAno = `${inicio.slice(0, 4)}-${inicio.slice(4, 6)}`

    if (!consultaMensal) {
      const linhas = lista.flatMap((item: Record<string, unknown>) => {
        const data = String(item.usedDate ?? '')
        const valor = Number(item.useAmount ?? item.energyUsage ?? 0)
        return /^\d{8}$/.test(data) && Number.isFinite(valor) ? [{
          maquina_id: maquina.id,
          data_referencia: `${data.slice(0, 4)}-${data.slice(4, 6)}-${data.slice(6, 8)}`,
          consumo_wh: valor,
          sincronizado_em: new Date().toISOString(),
        }] : []
      })
      if (linhas.length) {
        const { error } = await db.from('maquina_consumo_diario').upsert(linhas, {
          onConflict: 'maquina_id,data_referencia',
        })
        if (error) throw error
      }
    }

    const { data: mensal } = await db.from('consumo_maquina').select('ciclos')
      .eq('maquina_id', maquina.id).eq('mes_ano', mesAno).maybeSingle()
    const { error: erroMensal } = await db.from('consumo_maquina').upsert({
      maquina_id: maquina.id,
      mes_ano: mesAno,
      consumo_wh: totalWh,
      ciclos: mensal?.ciclos ?? 0,
    }, { onConflict: 'maquina_id,mes_ano' })
    if (erroMensal) throw erroMensal
    return { maquina: maquina.nome, device_id: maquina.device_id, mes_ano: mesAno, energy_wh: totalWh }
  } catch (erro) {
    return { maquina: maquina.nome, device_id: maquina.device_id, erro: erro instanceof Error ? erro.message : String(erro) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return Response.json({ error: 'Supabase não configurado.' }, { status: 500, headers: corsHeaders })
  const db = createClient(url, serviceKey)
  if (!await autorizado(req, db)) return Response.json({ error: 'Não autorizado.' }, { status: 401, headers: corsHeaders })

  const corpo = await req.json().catch(() => ({})) as {
    modo?: 'estado' | 'consumo'; device_id?: string; start_date?: string; end_date?: string
  }
  const modo = corpo.modo ?? 'estado'
  let consulta = db.from('maquina').select('id,nome,device_id').eq('ativo', true).not('device_id', 'is', null)
  if (corpo.device_id) consulta = consulta.eq('device_id', corpo.device_id)
  const { data, error } = await consulta
  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders })
  const maquinas = (data ?? []) as Maquina[]

  const resultados = await Promise.all(maquinas.map(maquina => modo === 'consumo'
    ? sincronizarConsumo(db, maquina, corpo.start_date, corpo.end_date)
    : sincronizarEstado(db, maquina)))
  const falhas = resultados.filter(item => 'erro' in item)
  return Response.json({ ok: falhas.length === 0, modo, maquinas: resultados }, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
