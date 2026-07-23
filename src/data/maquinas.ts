import { supabase } from '../lib/supabase'
import type { Maquina } from '../types/models'
import { dbErrorMessage } from './errors'

export async function fetchMaquinas(): Promise<{ data: Maquina[]; error: string | null }> {
  let { data, error } = await supabase.from('maquina').select('*').is('deletado_em', null).eq('ativo', true).order('nome', { ascending: true })
  if (error) {
    const res = await supabase.from('maquina').select('*').eq('ativo', true).order('nome', { ascending: true })
    data = res.data
    error = res.error
  }
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
  const agora = new Date().toISOString()
  const { error } = await supabase.from('maquina').update({ ativo: false, deletado_em: agora }).eq('id', id)
  if (!error) return { error: null }

  // Fallback se coluna deletado_em não existe
  const { error: e2 } = await supabase.from('maquina').update({ ativo: false }).eq('id', id)
  return { error: e2 ? dbErrorMessage(e2) : null }
}
