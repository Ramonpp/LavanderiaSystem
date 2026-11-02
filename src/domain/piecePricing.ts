import type { ItemPedido } from '../types/models'
import { formatBRL } from '../lib/format'

export function subtotalAdicionalItem(item: Pick<ItemPedido, 'quantidade' | 'preco_unitario'>) {
  return Number(item.quantidade ?? 0) * Number(item.preco_unitario ?? 0)
}

export function formatarItemCobranca(item: Pick<ItemPedido, 'quantidade' | 'preco_unitario'>, nome: string) {
  const preco = Number(item.preco_unitario ?? 0)
  const subtotal = subtotalAdicionalItem(item)
  if (preco <= 0) return `${item.quantidade}x ${nome}`
  return `${item.quantidade}x ${nome} — ${item.quantidade} × ${formatBRL(preco)} = ${formatBRL(subtotal)} (à parte)`
}

export function linhasAdicionaisCobranca(itens: ItemPedido[], nomeTipo: (tipoId: string) => string) {
  return itens
    .filter((item) => Number(item.preco_unitario ?? 0) > 0)
    .map((item) => formatarItemCobranca(item, nomeTipo(item.tipo_peca_id)))
}
