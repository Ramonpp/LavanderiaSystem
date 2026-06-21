import { supabase } from '../lib/supabase'
import type { ResumoMensal } from '../types/models'

export async function upsertResumoMensal(payload: {
  mes_ano: string
  total_pedidos: number
  total_kg: number
  custo_energia: number
  custo_agua: number
}): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('resumo_mensal')
    .upsert({ ...payload, atualizado_em: new Date().toISOString() }, { onConflict: 'mes_ano' })
  return { error: error?.message ?? null }
}

export async function fetchResumosMensais(limit = 12): Promise<{ data: ResumoMensal[]; error: string | null }> {
  const { data, error } = await supabase
    .from('resumo_mensal')
    .select('*')
    .order('mes_ano', { ascending: false })
    .limit(limit)
  return { data: (data ?? []) as ResumoMensal[], error: error?.message ?? null }
}
