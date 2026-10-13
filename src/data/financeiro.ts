import { supabase } from '../lib/supabase'
import type { ClienteFormaPagamento, Pagamento } from '../types/models'
import { dbErrorMessage } from './errors'

export async function fetchPagamentos(pedidoIds?: string[]): Promise<{ data: Pagamento[]; error: string | null }> {
  let query = supabase.from('pagamento').select('*').is('estornado_em', null).order('data', { ascending: false })
  if (pedidoIds) {
    if (pedidoIds.length === 0) return { data: [], error: null }
    query = query.in('pedido_id', pedidoIds)
  }
  const { data, error } = await query
  return { data: (data ?? []) as Pagamento[], error: error ? dbErrorMessage(error) : null }
}

export async function fetchPagamentosPorPeriodo(inicio: string, fim: string): Promise<{ data: Pagamento[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pagamento')
    .select('*')
    .is('estornado_em', null)
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: false })
  return { data: (data ?? []) as Pagamento[], error: error ? dbErrorMessage(error) : null }
}

export async function registrarPagamento(input: {
  pedidoId: string
  valor: number
  forma: ClienteFormaPagamento
  observacoes?: string
}): Promise<{ data: Pagamento | null; error: string | null }> {
  const { data, error } = await supabase.rpc('registrar_pagamento', {
    p_pedido_id: input.pedidoId,
    p_valor: input.valor,
    p_forma: input.forma,
    p_observacoes: input.observacoes?.trim() || null,
  })
  return { data: (data as Pagamento | null) ?? null, error: error ? dbErrorMessage(error) : null }
}

export async function registrarCobranca(input: {
  clienteId: string
  pedidoId?: string
  mensagem: string
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cobranca_evento').insert({
    cliente_id: input.clienteId,
    pedido_id: input.pedidoId ?? null,
    canal: 'whatsapp',
    mensagem: input.mensagem,
  })
  if (error) return { error: dbErrorMessage(error) }

  const { error: updateError } = await supabase
    .from('cliente')
    .update({ ultima_cobranca_em: new Date().toISOString() })
    .eq('id', input.clienteId)
  return { error: updateError ? dbErrorMessage(updateError) : null }
}

export async function atualizarPermissaoWhatsapp(clienteId: string, autorizado: boolean) {
  const { error } = await supabase
    .from('cliente')
    .update({ whatsapp_opt_in: autorizado })
    .eq('id', clienteId)
  return { error: error ? dbErrorMessage(error) : null }
}
