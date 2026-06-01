import { supabase } from '../lib/supabase'
import type { TipoPeca } from '../types/models'
import { dbErrorMessage } from './errors'

export async function fetchTiposPeca(): Promise<{ data: TipoPeca[]; error: string | null }> {
  const { data, error } = await supabase.from('tipo_peca').select('*').order('nome', { ascending: true })
  return { data: (data ?? []) as TipoPeca[], error: error ? dbErrorMessage(error) : null }
}

export async function insertTipoPeca(input: Omit<TipoPeca, 'id' | 'criado_em'>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tipo_peca').insert(input)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function updateTipoPeca(
  id: string,
  patch: Partial<Omit<TipoPeca, 'id' | 'criado_em'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tipo_peca').update(patch).eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function deleteTipoPeca(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tipo_peca').delete().eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

const CATALOGO_PADRAO: Omit<TipoPeca, 'id' | 'criado_em'>[] = [
  { nome: 'Toalha de banho',        descricao: 'Toalha de banho adulto',          peso_referencia_kg: 0.40 },
  { nome: 'Toalha de rosto',        descricao: 'Toalha de rosto / lavabo',         peso_referencia_kg: 0.15 },
  { nome: 'Toalha de piso',         descricao: 'Tapete/toalha de piso de banheiro', peso_referencia_kg: 0.35 },
  { nome: 'Lençol solteiro',        descricao: 'Lençol de cama solteiro',          peso_referencia_kg: 0.45 },
  { nome: 'Lençol casal',           descricao: 'Lençol de cama casal',             peso_referencia_kg: 0.65 },
  { nome: 'Fronha',                 descricao: 'Fronha de travesseiro',             peso_referencia_kg: 0.15 },
  { nome: 'Cobertor solteiro',      descricao: 'Cobertor de cama solteiro',        peso_referencia_kg: 1.00 },
  { nome: 'Cobertor casal',         descricao: 'Cobertor de cama casal',           peso_referencia_kg: 1.50 },
  { nome: 'Edredom solteiro',       descricao: 'Edredom / colcha solteiro',        peso_referencia_kg: 1.00 },
  { nome: 'Edredom casal',          descricao: 'Edredom / colcha casal',           peso_referencia_kg: 1.50 },
  { nome: 'Roupão',                 descricao: 'Roupão de banho adulto',           peso_referencia_kg: 0.80 },
  { nome: 'Toalha de mesa pequena', descricao: 'Toalha de mesa 4 lugares',        peso_referencia_kg: 0.40 },
  { nome: 'Toalha de mesa grande',  descricao: 'Toalha de mesa 8+ lugares',       peso_referencia_kg: 0.80 },
  { nome: 'Guardanapo',             descricao: 'Guardanapo de tecido',             peso_referencia_kg: 0.05 },
  { nome: 'Avental',                descricao: 'Avental de cozinha ou serviço',   peso_referencia_kg: 0.30 },
  { nome: 'Uniforme',               descricao: 'Uniforme / camisa profissional',  peso_referencia_kg: 0.40 },
  { nome: 'Pano de prato',          descricao: 'Pano de prato / copa',            peso_referencia_kg: 0.10 },
]

export async function popularCatalogoPadrao(): Promise<{ inseridos: number; error: string | null }> {
  const { data: existentes, error: eList } = await supabase
    .from('tipo_peca')
    .select('nome')
  if (eList) return { inseridos: 0, error: dbErrorMessage(eList) }

  const nomesExistentes = new Set((existentes ?? []).map((r: { nome: string }) => r.nome.toLowerCase()))
  const novos = CATALOGO_PADRAO.filter((p) => !nomesExistentes.has(p.nome.toLowerCase()))

  if (novos.length === 0) return { inseridos: 0, error: null }

  const { error } = await supabase.from('tipo_peca').insert(novos)
  return { inseridos: novos.length, error: error ? dbErrorMessage(error) : null }
}
