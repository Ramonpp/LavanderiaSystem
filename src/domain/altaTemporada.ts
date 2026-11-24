export function emAltaTemporada(data: string) {
  const mes = Number(data.slice(5, 7))
  return mes === 12 || mes === 1 || mes === 2
}

type Dia = { data: string; kg: number; pedidos: number }

export function estimarAltaTemporada(historico: Dia[], hoje: string) {
  const dias = historico.filter(dia => dia.data < hoje)
  const verao = dias.filter(dia => emAltaTemporada(dia.data))
  const restante = dias.filter(dia => !emAltaTemporada(dia.data))
  // Quatro semanas em cada grupo permitem comparar períodos com todos os dias da semana.
  function fator(campo: 'kg' | 'pedidos') {
    const totalFora = restante.reduce((soma, dia) => soma + dia[campo], 0)
    if (verao.length < 28 || restante.length < 28 || totalFora === 0) {
      return { valor: 1.2, provisao: true }
    }
    const mediaVerao = verao.reduce((soma, dia) => soma + dia[campo], 0) / verao.length
    // Um dia sem movimento entra na comparação, mas o ajuste precisa ser invertível.
    if (mediaVerao === 0) return { valor: 1.2, provisao: true }
    return { valor: mediaVerao / (totalFora / restante.length), provisao: false }
  }
  return { kg: fator('kg'), pedidos: fator('pedidos'), diasVerao: verao.length, diasFora: restante.length }
}
