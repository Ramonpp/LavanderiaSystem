import { supabase } from '../lib/supabase'
import type { ItemPedido, Pedido, PedidoCliente } from '../types/models'
import { dbErrorMessage } from './errors'

async function hydratePedidosComCliente(pedidos: Pedido[]): Promise<{
  data: PedidoCliente[]
  error: string | null
}> {
  const ids = [...new Set(pedidos.map((p) => p.cliente_id))].filter(Boolean)
  if (ids.length === 0) return { data: pedidos.map((p) => ({ ...p, cliente: null })), error: null }

  const { data: clientes, error } = await supabase.from('cliente').select('id, nome, condominio, bloco, apartamento, telefone, plano').in('id', ids)
  if (error) return { data: [], error: dbErrorMessage(error) }

  const map = new Map<string, { nome: string; condominio: string | null; bloco: string | null; apartamento: string | null; telefone: string | null; plano: any }>()
  ;(clientes ?? []).forEach((c: any) =>
    map.set(c.id, { nome: c.nome, condominio: c.condominio, bloco: c.bloco, apartamento: c.apartamento, telefone: c.telefone, plano: c.plano })
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
  let { data, error } = await supabase.from('pedido').select('*').is('deletado_em', null).order('data_pedido', { ascending: false })
  if (error) {
    // Fallback se coluna deletado_em ainda não foi criada no banco
    const res = await supabase.from('pedido').select('*').order('data_pedido', { ascending: false })
    data = res.data
    error = res.error
  }
  if (error) return { data: [], error: dbErrorMessage(error) }
  return hydratePedidosComCliente((data ?? []) as Pedido[])
}

export async function fetchPedidosPorPeriodo(params: {
  inicioIsoDate: string
  fimIsoDate: string
}): Promise<{ data: PedidoCliente[]; error: string | null }> {
  let { data, error } = await supabase
    .from('pedido')
    .select('*')
    .is('deletado_em', null)
    .gte('data_pedido', params.inicioIsoDate)
    .lte('data_pedido', params.fimIsoDate)
    .order('data_pedido', { ascending: false })

  if (error) {
    const res = await supabase
      .from('pedido')
      .select('*')
      .gte('data_pedido', params.inicioIsoDate)
      .lte('data_pedido', params.fimIsoDate)
      .order('data_pedido', { ascending: false })
    data = res.data
    error = res.error
  }

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
  const { data, error } = await supabase.rpc('criar_pedido_com_itens', {
    p_pedido: input.pedido,
    p_itens: input.itens,
  })
  if (error) return { pedidoId: null, error: dbErrorMessage(error) }
  return { pedidoId: typeof data === 'string' ? data : null, error: null }
}

export async function replaceItensPedido(pedidoId: string, itens: Array<Omit<ItemPedido, 'id' | 'pedido_id' | 'criado_em'>>) {
  const { error } = await supabase.rpc('substituir_itens_pedido', {
    p_pedido_id: pedidoId,
    p_itens: itens,
  })
  return { error: error ? dbErrorMessage(error) : null }
}

export async function updatePedido(
  id: string,
  patch: Partial<Omit<Pedido, 'id' | 'criado_em'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('pedido').update(patch).eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function deletePedido(id: string): Promise<{ error: string | null }> {
  const agora = new Date().toISOString()
  const { error } = await supabase.from('pedido').update({ status: 'cancelado', deletado_em: agora }).eq('id', id)
  if (!error) return { error: null }

  // Fallback se coluna deletado_em não existe
  const { error: e2 } = await supabase.from('pedido').update({ status: 'cancelado' }).eq('id', id)
  return { error: e2 ? dbErrorMessage(e2) : null }
}

export async function updateItemPedido(
  id: string,
  patch: Partial<Omit<ItemPedido, 'id' | 'criado_em'>>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('item_pedido').update(patch).eq('id', id)
  return { error: error ? dbErrorMessage(error) : null }
}

export async function fetchPedidosEmLavagem(): Promise<{ data: PedidoCliente[]; error: string | null }> {
  let { data, error } = await supabase
    .from('pedido')
    .select('*')
    .is('deletado_em', null)
    .eq('status', 'em_lavagem')
    .order('data_pedido', { ascending: false })

  if (error) {
    const res = await supabase
      .from('pedido')
      .select('*')
      .eq('status', 'em_lavagem')
      .order('data_pedido', { ascending: false })
    data = res.data
    error = res.error
  }

  if (error) return { data: [], error: dbErrorMessage(error) }
  return hydratePedidosComCliente((data ?? []) as Pedido[])
}

export async function fetchPedidosExpedicao(): Promise<{ data: PedidoCliente[]; error: string | null }> {
  let { data, error } = await supabase
    .from('pedido')
    .select('*')
    .is('deletado_em', null)
    .eq('status', 'pronto')
    .not('expedicao_em', 'is', null)
    .order('data_prevista_entrega', { ascending: true, nullsFirst: false })
    .order('data_pedido', { ascending: true })

  if (error) {
    const res = await supabase
      .from('pedido')
      .select('*')
      .eq('status', 'pronto')
      .not('expedicao_em', 'is', null)
      .order('data_pedido', { ascending: true })
    data = res.data
    error = res.error
  }

  if (error) return { data: [], error: dbErrorMessage(error) }
  return hydratePedidosComCliente((data ?? []) as Pedido[])
}
