import { supabase } from '../lib/supabase'
import type { Cliente } from '../types/models'
import { dbErrorMessage } from './errors'

function isMissingColumnError(msg: string, col: string) {
  const m = msg.toLowerCase()
  return m.includes('column') && m.includes(col.toLowerCase()) && (m.includes('does not exist') || m.includes('não existe'))
}

export async function fetchClientes(todos?: boolean): Promise<{ data: Cliente[]; error: string | null }> {
  let q = supabase.from('cliente').select('*').order('nome', { ascending: true })

  if (!todos) {
    q = q.eq('ativo', true)
  }

  // Tenta filtrar excluídos por deletado_em
  const { data, error } = await q.is('deletado_em', null)

  if (error) {
    const msg = dbErrorMessage(error)
    // Fallback se coluna deletado_em ainda não foi criada no banco
    if (isMissingColumnError(msg, 'deletado_em')) {
      const { data: d2, error: e2 } = todos
        ? await supabase.from('cliente').select('*').order('nome', { ascending: true })
        : await supabase.from('cliente').select('*').eq('ativo', true).order('nome', { ascending: true })
      return { data: (d2 ?? []) as Cliente[], error: e2 ? dbErrorMessage(e2) : null }
    }
    return { data: [], error: msg }
  }

  return { data: (data ?? []) as Cliente[], error: null }
}

export async function insertCliente(input: {
  nome: string
  documento?: string | null
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  condominio?: string | null
  bloco?: string | null
  apartamento?: string | null
  plano?: Cliente['plano']
  forma_pagamento?: Cliente['forma_pagamento']
  dia_pagamento?: number | null
  ativo?: boolean
}): Promise<{ id: string | null; error: string | null }> {
  const rowBase: Record<string, unknown> = {
    nome: input.nome,
    plano: input.plano ?? 'pagou',
    forma_pagamento: input.forma_pagamento ?? 'pix',
    ativo: input.ativo ?? true,
  }
  if (input.documento != null && input.documento !== '') rowBase.documento = input.documento
  if (input.telefone  != null && input.telefone  !== '') rowBase.telefone  = input.telefone
  if (input.email     != null && input.email     !== '') rowBase.email     = input.email
  if (input.endereco  != null && input.endereco  !== '') rowBase.endereco  = input.endereco
  if (input.condominio!= null && input.condominio!== '') rowBase.condominio= input.condominio
  if (input.bloco     != null && input.bloco     !== '') rowBase.bloco     = input.bloco
  if (input.apartamento!=null && input.apartamento!=='') rowBase.apartamento=input.apartamento
  if (input.dia_pagamento !== undefined) rowBase.dia_pagamento = input.dia_pagamento

  // 1) tenta salvar com plano/forma_pagamento (schema novo)
  {
    const { data, error } = await supabase.from('cliente').insert(rowBase).select('id').single()
    if (!error) return { id: data?.id ?? null, error: null }

    const msg = dbErrorMessage(error)
    // 2) fallback: se o banco ainda não tem essas colunas, salva sem elas
    if (isMissingColumnError(msg, 'plano') || isMissingColumnError(msg, 'forma_pagamento') || isMissingColumnError(msg, 'dia_pagamento')) {
      const { plano: _p, forma_pagamento: _f, dia_pagamento: _d, ...rowFallback } = rowBase
      const { data: d2, error: e2 } = await supabase.from('cliente').insert(rowFallback).select('id').single()
      return { id: d2?.id ?? null, error: e2 ? dbErrorMessage(e2) : null }
    }

    return { id: null, error: msg }
  }
}

export async function updateCliente(
  id: string,
  patch: Partial<
    Omit<Cliente, 'id' | 'criado_em'>
  >,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cliente').update(patch).eq('id', id)
  if (!error) return { error: null }

  const msg = dbErrorMessage(error)
  if (isMissingColumnError(msg, 'plano') || isMissingColumnError(msg, 'forma_pagamento') || isMissingColumnError(msg, 'dia_pagamento')) {
    const p2 = { ...(patch as Record<string, unknown>) }
    delete p2.plano
    delete p2.forma_pagamento
    delete p2.dia_pagamento
    const { error: e2 } = await supabase.from('cliente').update(p2).eq('id', id)
    return { error: e2 ? dbErrorMessage(e2) : null }
  }

  return { error: msg }
}

export async function deleteCliente(id: string): Promise<{ error: string | null }> {
  const agora = new Date().toISOString()
  const { error } = await supabase
    .from('cliente')
    .update({ ativo: false, deletado_em: agora })
    .eq('id', id)

  if (!error) return { error: null }

  const msg = dbErrorMessage(error)
  if (isMissingColumnError(msg, 'deletado_em')) {
    const { error: e2 } = await supabase.from('cliente').update({ ativo: false }).eq('id', id)
    return { error: e2 ? dbErrorMessage(e2) : null }
  }

  return { error: msg }
}

export const deleteClienteHard = deleteCliente

