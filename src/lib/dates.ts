export function isoDatePartsLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return { y, m, day }
}

export function isoDateLocal(d: Date) {
  const { y, m, day } = isoDatePartsLocal(d)
  return `${y}-${m}-${day}`
}

export function monthBoundsLocal(year: number, month1to12: number) {
  const start = new Date(year, month1to12 - 1, 1)
  const end = new Date(year, month1to12, 0)
  return { start: isoDateLocal(start), end: isoDateLocal(end) }
}

function isoDateUtc(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function proximoDiaUtil(year: number, monthIndex: number, day: number) {
  const data = new Date(Date.UTC(year, monthIndex, day))
  while (data.getUTCDay() === 0 || data.getUTCDay() === 6) {
    data.setUTCDate(data.getUTCDate() + 1)
  }
  return data
}

export function utilityBillingPeriods(year: number, month1to12: number) {
  const aguaInicioBase = new Date(Date.UTC(year, month1to12 - 2, 8))
  const aguaFimBase = new Date(Date.UTC(year, month1to12 - 1, 8))
  const aguaInicio = proximoDiaUtil(aguaInicioBase.getUTCFullYear(), aguaInicioBase.getUTCMonth(), 8)
  const aguaFim = proximoDiaUtil(aguaFimBase.getUTCFullYear(), aguaFimBase.getUTCMonth(), 8)
  const energiaInicio = new Date(Date.UTC(year, month1to12 - 2, 15))
  const energiaFim = new Date(Date.UTC(year, month1to12 - 1, 15))

  return {
    agua: {
      inicio: isoDateUtc(aguaInicio),
      fim: isoDateUtc(aguaFim),
      inicioAjustado: aguaInicio.getTime() !== aguaInicioBase.getTime(),
      fimAjustado: aguaFim.getTime() !== aguaFimBase.getTime(),
    },
    energia: {
      inicio: isoDateUtc(energiaInicio),
      fim: isoDateUtc(energiaFim),
    },
  }
}

export function formatIsoDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

export function currentYearMonth(): { year: number; month: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function formatMesAno(monthValue: string): string {
  const [y, m] = monthValue.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return monthValue
  return `${MESES[m - 1]} de ${y}`
}
