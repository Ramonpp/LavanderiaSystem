import { supabase } from '../lib/supabase'
import type { Maquina } from '../types/models'
import { dbErrorMessage } from './errors'

export async function fetchMaquinas(): Promise<{ data: Maquina[]; error: string | null }> {
  const { data, error } = await supabase.from('maquina').select('*').order('nome', { ascending: true })
  return { data: (data ?? []) as Maquina[], error: error ? dbErrorMessage(error) : null }
}

export async function insertMaquina(input: Omit<Maquina, 'id' | 'criado_em'>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('maquina').insert(input)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function updateMaquina(
  id: string,
  patch: Partial<Omit<Maquina, 'id' | 'criado_em'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('maquina').update(patch).eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function deleteMaquina(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('maquina').delete().eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}
