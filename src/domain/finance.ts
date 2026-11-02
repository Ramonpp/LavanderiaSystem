import type { Despesa, Pedido } from '../types/models'

export const PRECO_MINIMO_PEDIDO = 40

type PedidoComPreco = Pick<
  Pedido,
  'peso_kg' | 'preco_por_kg' | 'preco_fixo' | 'adicional_pecas' | 'desconto_valor' | 'desconto_tipo'
>

export function receitaOriginalPedido(p: Pick<Pedido, 'peso_kg' | 'preco_por_kg' | 'preco_fixo' | 'adicional_pecas'>): number {
  const adicional = Number(p.adicional_pecas ?? 0)
  if (typeof p.preco_fixo === 'number' && !Number.isNaN(p.preco_fixo)) {
    return p.preco_fixo + adicional
  }
  const precoKg = p.preco_por_kg ?? 0
  return (p.peso_kg ?? 0) * precoKg + adicional
}

export function receitaPedidoSemMinimo(p: PedidoComPreco): number {
  let total = receitaOriginalPedido(p)

  const descVal = p.desconto_valor ?? 0
  if (descVal > 0) {
    if (p.desconto_tipo === 'percentual') {
      total = total * (1 - descVal / 100)
    } else {
      total = Math.max(0, total - descVal)
    }
  }
  return total
}

export function pedidoComPrecoMinimo(p: PedidoComPreco): boolean {
  return receitaPedidoSemMinimo(p) < PRECO_MINIMO_PEDIDO
}

export function receitaPedido(p: PedidoComPreco): number {
  return Math.max(PRECO_MINIMO_PEDIDO, receitaPedidoSemMinimo(p))
}

export function somaDespesas(despesas: Array<Pick<Despesa, 'valor'>>): number {
  return despesas.reduce((acc, d) => acc + (d.valor ?? 0), 0)
}

export function lucroPedidoEstimado(args: {
  pedido: Pick<Pedido, 'peso_kg' | 'preco_por_kg' | 'preco_fixo' | 'adicional_pecas'>
  custoVariavelEstimadoPorKg: number
}): number {
  const receita = receitaPedido(args.pedido)
  const custo = (args.pedido.peso_kg ?? 0) * (args.custoVariavelEstimadoPorKg ?? 0)
  return receita - custo
}

