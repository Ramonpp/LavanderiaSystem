import { supabase } from '../lib/supabase'
import type { ItemPedido, Pedido, PedidoCliente } from '../types/models'
import { dbErrorMessage } from './errors'

async function hydratePedidosComCliente(pedidos: Pedido[]): Promise<{
  data: PedidoCliente[]
  error: string | null
}> {
  const ids = [...new Set(pedidos.map((p) => p.cliente_id))].filter(Boolean)
  if (ids.length === 0) return { data: pedidos.map((p) => ({ ...p, cliente: null })), error: null }

  const { data: clientes, error } = await supabase.from('cliente').select('id, nome, condominio, bloco, apartamento, plano').in('id', ids)
  if (error) return { data: [], error: dbErrorMessage(error) }

  const map = new Map<string, { nome: string; condominio: string | null; bloco: string | null; apartamento: string | null; plano: any }>()
  ;(clientes ?? []).forEach((c: any) =>
    map.set(c.id, { nome: c.nome, condominio: c.condominio, bloco: c.bloco, apartamento: c.apartamento, plano: c.plano })
  )

  return {
    data: pedidos.map((p) => ({
      ...p,
      cliente: map.has(p.cliente_id)
        ? { id: p.cliente_id, ...map.get(p.cliente_id)! }
        : null,
    })),
    error: null,
  }
}

export async function fetchPedidos(): Promise<{ data: PedidoCliente[]; error: string | null }> {
  const { data, error } = await supabase.from('pedido').select('*').order('data_pedido', { ascending: false })
  if (error) return { data: [], error: dbErrorMessage(error) }
  return hydratePedidosComCliente((data ?? []) as Pedido[])
}

export async function fetchPedidosPorPeriodo(params: {
  inicioIsoDate: string
  fimIsoDate: string
}): Promise<{ data: PedidoCliente[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pedido')
    .select('*')
    .gte('data_pedido', params.inicioIsoDate)
    .lte('data_pedido', params.fimIsoDate)
    .order('data_pedido', { ascending: false })

  if (error) return { data: [], error: dbErrorMessage(error) }
  return hydratePedidosComCliente((data ?? []) as Pedido[])
}

export async function fetchItensPorPedidos(pedidoIds: string[]): Promise<{ data: ItemPedido[]; error: string | null }> {
  if (pedidoIds.length === 0) return { data: [], error: null }
  const { data, error } = await supabase.from('item_pedido').select('*').in('pedido_id', pedidoIds)

  return { data: (data ?? []) as ItemPedido[], error: error ? dbErrorMessage(error) : null }
}

export async function insertPedidoComItens(input: {
  pedido: Omit<Pedido, 'id' | 'criado_em'>
  itens: Array<Omit<ItemPedido, 'id' | 'pedido_id' | 'criado_em'>>
}): Promise<{ pedidoId: string | null; error: string | null }> {
  const { data: created, error: e1 } = await supabase
    .from('pedido')
    .insert(input.pedido)
    .select('id')
    .single()

  if (e1) return { pedidoId: null, error: dbErrorMessage(e1) }

  const pedidoId = created?.id as string | undefined
  if (!pedidoId) return { pedidoId: null, error: 'Não foi possível criar o pedido.' }

  if (input.itens.length > 0) {
    const { error: e2 } = await supabase.from('item_pedido').insert(
      input.itens.map((it) => ({
        ...it,
        pedido_id: pedidoId,
      })),
    )
    if (e2) return { pedidoId, error: dbErrorMessage(e2) }
  }

  return { pedidoId, error: null }
}

export async function replaceItensPedido(pedidoId: string, itens: Array<Omit<ItemPedido, 'id' | 'pedido_id' | 'criado_em'>>) {
  const { error: d } = await supabase.from('item_pedido').delete().eq('pedido_id', pedidoId)
  if (d) return { error: dbErrorMessage(d) }

  if (itens.length === 0) return { error: null as string | null }
  const { error: i } = await supabase.from('item_pedido').insert(
    itens.map((it) => ({
      ...it,
      pedido_id: pedidoId,
    })),
  )
  return { error: i ? dbErrorMessage(i) : null }
}

export async function updatePedido(
  id: string,
  patch: Partial<Omit<Pedido, 'id' | 'criado_em'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pedido').update(patch).eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function deletePedido(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pedido').delete().eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function updateItemPedido(
  id: string,
  patch: Partial<Omit<ItemPedido, 'id' | 'criado_em'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('item_pedido').update(patch).eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function fetchPedidosEmLavagem(): Promise<{ data: PedidoCliente[]; error: string | null }> {
  const { data, error } = await supabase
    .from('pedido')
    .select('*')
    .eq('status', 'em_lavagem')
    .order('data_pedido', { ascending: false })

  if (error) return { data: [], error: dbErrorMessage(error) }
  return hydratePedidosComCliente((data ?? []) as Pedido[])
}
