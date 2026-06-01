import { supabase } from '../lib/supabase'
import type { Despesa } from '../types/models'
import { dbErrorMessage } from './errors'

export async function fetchDespesasPorPeriodo(params: {
  inicioIsoDate: string
  fimIsoDate: string
}): Promise<{ data: Despesa[]; error: string | null }> {
  const { data, error } = await supabase
    .from('despesa')
    .select('*')
    .gte('data', params.inicioIsoDate)
    .lte('data', params.fimIsoDate)
    .order('data', { ascending: false })

  return { data: (data ?? []) as Despesa[], error: error ? dbErrorMessage(error) : null }
}

export async function insertDespesa(input: Omit<Despesa, 'id' | 'criado_em'>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('despesa').insert(input)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function deleteDespesa(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('despesa').delete().eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function insertDespesasLote(
  inputs: Omit<Despesa, 'id' | 'criado_em'>[],
): Promise<{ error: string | null }> {
  if (inputs.length === 0) return { error: null }
  const { error } = await supabase.from('despesa').insert(inputs)
  return { error: error ? dbErrorMessage(error) : null }
}
