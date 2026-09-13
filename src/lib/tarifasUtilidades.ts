export interface FaixaEnelResidencial {
  id: string
  faixa: string
  limiteMinKwh: number
  limiteMaxKwh: number | null
  aliquotaIcms: number // Ex: 0, 20 (18+2 FECOP), 29 (27+2 FECOP), 33 (31+2 FECOP)
  aliquotaPisCofins: number // Ex: ~4.5% a 5.5%
  tarifaComImpostos: number // R$ / kWh
  descricao: string
}

/**
 * Estrutura Tarifária Enel Distribuição Rio - Baixa Tensão Residencial (B1) Trifásico
 * Custo de disponibilidade Trifásico: 100 kWh/mês mínimo faturável
 */
export const TABELA_ENEL_RESIDENCIAL: FaixaEnelResidencial[] = [
  {
    id: 'faixa_1',
    faixa: '0 a 50 kWh',
    limiteMinKwh: 0,
    limiteMaxKwh: 50,
    aliquotaIcms: 0,
    aliquotaPisCofins: 4.5,
    tarifaComImpostos: 0.84,
    descricao: 'Isento de ICMS (apenas PIS/COFINS)',
  },
  {
    id: 'faixa_2',
    faixa: '51 a 300 kWh',
    limiteMinKwh: 51,
    limiteMaxKwh: 300,
    aliquotaIcms: 20, // 18% ICMS + 2% FECOP
    aliquotaPisCofins: 5.0,
    tarifaComImpostos: 1.09,
    descricao: 'ICMS 18% + FECOP 2% + PIS/COFINS',
  },
  {
    id: 'faixa_3',
    faixa: '301 a 450 kWh',
    limiteMinKwh: 301,
    limiteMaxKwh: 450,
    aliquotaIcms: 29, // 27% ICMS + 2% FECOP
    aliquotaPisCofins: 5.5,
    tarifaComImpostos: 1.26,
    descricao: 'ICMS 27% + FECOP 2% + PIS/COFINS',
  },
  {
    id: 'faixa_4',
    faixa: 'Acima de 450 kWh',
    limiteMinKwh: 451,
    limiteMaxKwh: null,
    aliquotaIcms: 33, // 31% ICMS + 2% FECOP
    aliquotaPisCofins: 5.5,
    tarifaComImpostos: 1.36,
    descricao: 'ICMS 31% + FECOP 2% + PIS/COFINS',
  },
]

export interface ResultadoCalculoEnergiaEnel {
  kwhConsumido: number
  kwhFaturado: number
  custoTotal: number
  tarifaKwh: number
  faixaNome: string
  aliquotaIcmsTexto: string
  aliquotaTotalTexto: string
  minimoTrifasicoAplicado: boolean
}

/**
 * Calcula o custo de energia elétrica de acordo com a tabela Enel Residencial Trifásico (B1)
 * @param kwhConsumido Total de kWh consumido no período
 * @param aplicarMinimoTrifasico Se true (padrão), garante o faturamento mínimo de 100 kWh se consumo > 0
 */
export function calcularCustoEnergiaEnelResidencial(
  kwhConsumido: number,
  aplicarMinimoTrifasico = true
): ResultadoCalculoEnergiaEnel {
  if (kwhConsumido <= 0) {
    return {
      kwhConsumido: 0,
      kwhFaturado: 0,
      custoTotal: 0,
      tarifaKwh: 0,
      faixaNome: 'Sem consumo',
      aliquotaIcmsTexto: '0%',
      aliquotaTotalTexto: '0%',
      minimoTrifasicoAplicado: false,
    }
  }

  // No trifásico, o mínimo faturável por disponibilidade da concessionária é 100 kWh
  const minimoTrifasicoAplicado = aplicarMinimoTrifasico && kwhConsumido < 100
  const kwhFaturado = minimoTrifasicoAplicado ? 100 : kwhConsumido

  let faixa = TABELA_ENEL_RESIDENCIAL[0]
  if (kwhFaturado <= 50) {
    faixa = TABELA_ENEL_RESIDENCIAL[0]
  } else if (kwhFaturado <= 300) {
    faixa = TABELA_ENEL_RESIDENCIAL[1]
  } else if (kwhFaturado <= 450) {
    faixa = TABELA_ENEL_RESIDENCIAL[2]
  } else {
    faixa = TABELA_ENEL_RESIDENCIAL[3]
  }

  const custoTotal = kwhFaturado * faixa.tarifaComImpostos

  return {
    kwhConsumido,
    kwhFaturado,
    custoTotal,
    tarifaKwh: faixa.tarifaComImpostos,
    faixaNome: faixa.faixa,
    aliquotaIcmsTexto: `${faixa.aliquotaIcms}%`,
    aliquotaTotalTexto: `~${(faixa.aliquotaIcms + faixa.aliquotaPisCofins).toFixed(1)}%`,
    minimoTrifasicoAplicado,
  }
}

export interface FaixaAguaProlagos {
  faixa: string
  limiteMinM3: number
  limiteMaxM3: number | null
  tarifaPorM3: number
  observacao: string
}

export const TABELA_AGUA_PROLAGOS: FaixaAguaProlagos[] = [
  { faixa: '0 a 10 m³', limiteMinM3: 0, limiteMaxM3: 10, tarifaPorM3: 17.04, observacao: 'Mínimo obrigatório de R$ 170,40' },
  { faixa: '11 a 15 m³', limiteMinM3: 11, limiteMaxM3: 15, tarifaPorM3: 22.32, observacao: 'Tarifa R$ 22,32 / m³' },
  { faixa: '16 a 25 m³', limiteMinM3: 16, limiteMaxM3: 25, tarifaPorM3: 35.74, observacao: 'Tarifa R$ 35,74 / m³' },
  { faixa: '26 a 35 m³', limiteMinM3: 26, limiteMaxM3: 35, tarifaPorM3: 42.88, observacao: 'Tarifa R$ 42,88 / m³' },
  { faixa: '36 a 45 m³', limiteMinM3: 36, limiteMaxM3: 45, tarifaPorM3: 51.46, observacao: 'Tarifa R$ 51,46 / m³' },
  { faixa: '46 a 55 m³', limiteMinM3: 46, limiteMaxM3: 55, tarifaPorM3: 63.18, observacao: 'Tarifa R$ 63,18 / m³' },
  { faixa: '56 a 65 m³', limiteMinM3: 56, limiteMaxM3: 65, tarifaPorM3: 80.25, observacao: 'Tarifa R$ 80,25 / m³' },
  { faixa: 'Acima de 65 m³', limiteMinM3: 66, limiteMaxM3: null, tarifaPorM3: 91.26, observacao: 'Tarifa R$ 91,26 / m³' },
]

export function calcularCustoAguaProlagos(vM3: number): { custo: number; faixa: string; tarifa: number } {
  if (vM3 <= 0) return { custo: 0, faixa: 'Sem consumo', tarifa: 0 }
  if (vM3 <= 10) {
    return { custo: 170.40, faixa: '0 a 10 m³', tarifa: 17.04 }
  } else if (vM3 <= 15) {
    return { custo: vM3 * 22.32, faixa: '11 a 15 m³', tarifa: 22.32 }
  } else if (vM3 <= 25) {
    return { custo: vM3 * 35.74, faixa: '16 a 25 m³', tarifa: 35.74 }
  } else if (vM3 <= 35) {
    return { custo: vM3 * 42.88, faixa: '26 a 35 m³', tarifa: 42.88 }
  } else if (vM3 <= 45) {
    return { custo: vM3 * 51.46, faixa: '36 a 45 m³', tarifa: 51.46 }
  } else if (vM3 <= 55) {
    return { custo: vM3 * 63.18, faixa: '46 a 55 m³', tarifa: 63.18 }
  } else if (vM3 <= 65) {
    return { custo: vM3 * 80.25, faixa: '56 a 65 m³', tarifa: 80.25 }
  } else {
    return { custo: vM3 * 91.26, faixa: 'Acima 65 m³', tarifa: 91.26 }
  }
}
