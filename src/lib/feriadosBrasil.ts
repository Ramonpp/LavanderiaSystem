export type TipoEventoBrasil = 'feriado' | 'ponto_facultativo'

export type EventoBrasil = {
  data: string
  nome: string
  tipo: TipoEventoBrasil
}

const DIA_MS = 86_400_000

function isoUtc(ano: number, mes: number, dia: number) {
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10)
}

export function somarDiasIso(dataIso: string, dias: number) {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia) + dias * DIA_MS).toISOString().slice(0, 10)
}

// Algoritmo gregoriano de Meeus/Jones/Butcher.
function domingoPascoa(ano: number) {
  const a = ano % 19
  const b = Math.floor(ano / 100)
  const c = ano % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return isoUtc(ano, mes, dia)
}

export function eventosBrasil(ano: number): EventoBrasil[] {
  const pascoa = domingoPascoa(ano)
  const fixos: EventoBrasil[] = [
    { data: isoUtc(ano, 1, 1), nome: 'Confraternização Universal', tipo: 'feriado' },
    { data: isoUtc(ano, 4, 21), nome: 'Tiradentes', tipo: 'feriado' },
    { data: isoUtc(ano, 5, 1), nome: 'Dia do Trabalho', tipo: 'feriado' },
    { data: isoUtc(ano, 9, 7), nome: 'Independência do Brasil', tipo: 'feriado' },
    { data: isoUtc(ano, 10, 12), nome: 'Nossa Senhora Aparecida', tipo: 'feriado' },
    { data: isoUtc(ano, 11, 2), nome: 'Finados', tipo: 'feriado' },
    { data: isoUtc(ano, 11, 15), nome: 'Proclamação da República', tipo: 'feriado' },
    { data: isoUtc(ano, 11, 20), nome: 'Consciência Negra', tipo: 'feriado' },
    { data: isoUtc(ano, 12, 25), nome: 'Natal', tipo: 'feriado' },
  ]
  const moveis: EventoBrasil[] = [
    { data: somarDiasIso(pascoa, -48), nome: 'Carnaval (segunda-feira)', tipo: 'ponto_facultativo' },
    { data: somarDiasIso(pascoa, -47), nome: 'Carnaval', tipo: 'ponto_facultativo' },
    { data: somarDiasIso(pascoa, -46), nome: 'Quarta-feira de Cinzas', tipo: 'ponto_facultativo' },
    { data: somarDiasIso(pascoa, -2), nome: 'Paixão de Cristo', tipo: 'feriado' },
    { data: somarDiasIso(pascoa, 60), nome: 'Corpus Christi', tipo: 'ponto_facultativo' },
    { data: isoUtc(ano, 12, 24), nome: 'Véspera de Natal', tipo: 'ponto_facultativo' },
    { data: isoUtc(ano, 12, 31), nome: 'Véspera de Ano-Novo', tipo: 'ponto_facultativo' },
  ]
  return [...fixos, ...moveis].sort((a, b) => a.data.localeCompare(b.data))
}

export function mapaEventosBrasil(anos: number[]) {
  return new Map(anos.flatMap(eventosBrasil).map((evento) => [evento.data, evento]))
}
