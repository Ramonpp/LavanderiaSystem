import { supabase } from '../lib/supabase'
import type { PedidoCliente, Despesa } from '../types/models'
import { dbErrorMessage } from './errors'

/** Busca pedidos de um ano inteiro (Jan–Dez) de uma única vez */
export async function fetchPedidosPorAno(ano: number): Promise<{
  data: PedidoCliente[]
  error: string | null
}> {
  const inicio = `${ano}-01-01`
  const fim = `${ano}-12-31`
  const { data, error } = await supabase
    .from('pedido')
    .select('*, cliente:cliente_id(id, nome, condominio, bloco, apartamento, plano)')
    .gte('data_pedido', inicio)
    .lte('data_pedido', fim)
    .order('data_pedido', { ascending: true })

  return { data: (data ?? []) as PedidoCliente[], error: error ? dbErrorMessage(error) : null }
}

/** Busca despesas de um ano inteiro */
export async function fetchDespesasPorAno(ano: number): Promise<{
  data: Despesa[]
  error: string | null
}> {
  const inicio = `${ano}-01-01`
  const fim = `${ano}-12-31`
  const { data, error } = await supabase
    .from('despesa')
    .select('*')
    .gte('data', inicio)
    .lte('data', fim)
    .order('data', { ascending: true })

  return { data: (data ?? []) as Despesa[], error: error ? dbErrorMessage(error) : null }
}
