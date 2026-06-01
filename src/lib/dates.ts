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
