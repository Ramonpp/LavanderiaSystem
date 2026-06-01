import type { Maquina } from '../types/models'

export function capacidadeKgDia(maquinas: Array<Pick<Maquina, 'tipo' | 'capacidade_kg' | 'ciclos_por_dia_util' | 'ativo'>>) {
  const ativas = maquinas.filter((m) => m.ativo)
  const lavagem = ativas
    .filter((m) => m.tipo === 'lavagem')
    .reduce((acc, m) => acc + (m.capacidade_kg ?? 0) * (m.ciclos_por_dia_util ?? 0), 0)
  const secagem = ativas
    .filter((m) => m.tipo === 'secagem')
    .reduce((acc, m) => acc + (m.capacidade_kg ?? 0) * (m.ciclos_por_dia_util ?? 0), 0)

  let gargaloKgDia = 0
  if (lavagem > 0 && secagem > 0) gargaloKgDia = Math.min(lavagem, secagem)
  else gargaloKgDia = Math.max(lavagem, secagem)

  return {
    lavagemKgDia: lavagem,
    secagemKgDia: secagem,
    gargaloKgDia,
  }
}

export function lucroPotencialMensal(args: {
  capacidadeKgDia: number
  diasUteisMes: number
  precoReferenciaKg: number
  custoVariavelPorKg: number
  despesasFixasMensais: number
}) {
  const kgMes = (args.capacidadeKgDia ?? 0) * (args.diasUteisMes ?? 0)
  const receita = kgMes * (args.precoReferenciaKg ?? 0)
  const custoVariavel = kgMes * (args.custoVariavelPorKg ?? 0)
  const lucro = receita - custoVariavel - (args.despesasFixasMensais ?? 0)
  return { kgMes, receita, custoVariavel, lucro }
}

