import { supabase } from '../lib/supabase'
import type { Despesa } from '../types/models'
import { dbErrorMessage } from './errors'

export async function fetchDespesasPorPeriodo(params: {
  inicioIsoDate: string
  fimIsoDate: string
}): Promise<{ data: Despesa[]; error: string | null }> {
  let { data, error } = await supabase
    .from('despesa')
    .select('*')
    .is('deletado_em', null)
    .gte('data', params.inicioIsoDate)
    .lte('data', params.fimIsoDate)
    .order('data', { ascending: false })

  if (error) {
    const res = await supabase
      .from('despesa')
      .select('*')
      .gte('data', params.inicioIsoDate)
      .lte('data', params.fimIsoDate)
      .order('data', { ascending: false })
    data = res.data
    error = res.error
  }

  return { data: (data ?? []) as Despesa[], error: error ? dbErrorMessage(error) : null }
}

export async function insertDespesa(input: Omit<Despesa, 'id' | 'criado_em'>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('despesa').insert(input)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function deleteDespesa(id: string): Promise<{ error: string | null }> {
  const agora = new Date().toISOString()
  const { error } = await supabase.from('despesa').update({ deletado_em: agora }).eq('id', id)
  if (!error) return { error: null }

  // Fallback se coluna deletado_em não existe
  const { error: e2 } = await supabase.from('despesa').delete().eq('id', id)
  return { error: e2 ? dbErrorMessage(e2) : null }
}

export async function insertDespesasLote(
  inputs: Omit<Despesa, 'id' | 'criado_em'>[],
): Promise<{ error: string | null }> {
  if (inputs.length === 0) return { error: null }
  const { error } = await supabase.from('despesa').insert(inputs)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function updateDespesa(
  id: string,
  patch: Partial<Omit<Despesa, 'id' | 'criado_em'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('despesa').update(patch).eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}
