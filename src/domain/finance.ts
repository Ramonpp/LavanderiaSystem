import type { Despesa, Pedido } from '../types/models'

export function receitaPedido(p: Pick<Pedido, 'peso_kg' | 'preco_por_kg' | 'preco_fixo' | 'desconto_valor' | 'desconto_tipo'>): number {
  let total: number
  if (typeof p.preco_fixo === 'number' && !Number.isNaN(p.preco_fixo)) {
    total = p.preco_fixo
  } else {
    const precoKg = p.preco_por_kg ?? 0
    total = (p.peso_kg ?? 0) * precoKg
  }

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

export function somaDespesas(despesas: Array<Pick<Despesa, 'valor'>>): number {
  return despesas.reduce((acc, d) => acc + (d.valor ?? 0), 0)
}

export function lucroPedidoEstimado(args: {
  pedido: Pick<Pedido, 'peso_kg' | 'preco_por_kg' | 'preco_fixo'>
  custoVariavelEstimadoPorKg: number
}): number {
  const receita = receitaPedido(args.pedido)
  const custo = (args.pedido.peso_kg ?? 0) * (args.custoVariavelEstimadoPorKg ?? 0)
  return receita - custo
}

