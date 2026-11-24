import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosParaProjecao, type PedidoProjecao } from '../data/pedidos'
import { mapaEventosBrasil, somarDiasIso, type EventoBrasil } from '../lib/feriadosBrasil'
import styles from './ProjecaoDemandaPage.module.css'
import { emAltaTemporada, estimarAltaTemporada } from '../domain/altaTemporada'

const DIA_MS = 86_400_000
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

type DiaDemanda = {
  data: string
  pedidos: number
  kg: number
  diaSemana: number
  evento?: EventoBrasil
  contexto: string | null
  contextoTipo: 'feriado' | 'facultativo' | 'antes' | 'depois' | null
}

type Previsao = DiaDemanda & {
  kgPrevisto: number
  pedidosPrevistos: number
  nivel: 'Alta' | 'Média' | 'Baixa'
  confianca: 'alta' | 'média' | 'baixa'
}

function partesIso(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return { ano, mes, dia }
}

function diaSemanaIso(data: string) {
  const { ano, mes, dia } = partesIso(data)
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
}

function hojeBrasil() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function formatarData(data: string) {
  const { ano, mes, dia } = partesIso(data)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, mes - 1, dia)))
}

function listarDatas(inicio: string, fim: string) {
  const a = partesIso(inicio)
  const b = partesIso(fim)
  const inicioMs = Date.UTC(a.ano, a.mes - 1, a.dia)
  const fimMs = Date.UTC(b.ano, b.mes - 1, b.dia)
  const datas: string[] = []
  for (let atual = inicioMs; atual <= fimMs; atual += DIA_MS) datas.push(new Date(atual).toISOString().slice(0, 10))
  return datas
}

function media(valores: number[]) {
  return valores.length ? valores.reduce((soma, valor) => soma + valor, 0) / valores.length : 0
}

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor))
}

function contextoCalendario(data: string, eventos: Map<string, EventoBrasil>) {
  const evento = eventos.get(data)
  if (evento) return {
    evento,
    texto: evento.nome,
    tipo: evento.tipo === 'feriado' ? 'feriado' as const : 'facultativo' as const,
  }
  const amanha = eventos.get(somarDiasIso(data, 1))
  if (amanha) return { evento: undefined, texto: `Véspera de ${amanha.nome}`, tipo: 'antes' as const }
  const ontem = eventos.get(somarDiasIso(data, -1))
  if (ontem) return { evento: undefined, texto: `Após ${ontem.nome}`, tipo: 'depois' as const }
  return { evento: undefined, texto: null, tipo: null }
}

function badgeClass(tipo: DiaDemanda['contextoTipo']) {
  if (tipo === 'feriado') return styles.badgeHoliday
  if (tipo === 'facultativo') return styles.badgeOptional
  if (tipo === 'depois') return styles.badgeAfter
  return styles.badgeNear
}

function descricaoCalendario(dia: DiaDemanda) {
  return [dia.contexto, emAltaTemporada(dia.data) && 'Alta temporada'].filter(Boolean).join(' · ') || 'Dia normal'
}

function arredondar(valor: number, casas = 1) {
  const fator = 10 ** casas
  return Math.round(valor * fator) / fator
}

export function ProjecaoDemandaPage() {
  const [pedidos, setPedidos] = useState<PedidoProjecao[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [horizonte, setHorizonte] = useState(90)

  useEffect(() => {
    let ativo = true
    void fetchPedidosParaProjecao().then((resultado) => {
      if (!ativo) return
      setPedidos(resultado.data)
      setErro(resultado.error)
      setLoading(false)
    })
    return () => { ativo = false }
  }, [])

  const analise = useMemo(() => {
    const hoje = hojeBrasil()
    const datasValidas = pedidos.map((pedido) => pedido.data_pedido.slice(0, 10)).filter((data) => /^\d{4}-\d{2}-\d{2}$/.test(data))
    const inicio = datasValidas.sort()[0] ?? hoje
    const fimPrevisao = somarDiasIso(hoje, horizonte)
    const anoInicio = Number(inicio.slice(0, 4))
    const anoFim = Number(fimPrevisao.slice(0, 4))
    const eventos = mapaEventosBrasil(Array.from({ length: anoFim - anoInicio + 1 }, (_, i) => anoInicio + i))

    const porData = new Map<string, { pedidos: number; kg: number }>()
    pedidos.forEach((pedido) => {
      const data = pedido.data_pedido.slice(0, 10)
      const atual = porData.get(data) ?? { pedidos: 0, kg: 0 }
      atual.pedidos += 1
      atual.kg += Number(pedido.peso_kg) || 0
      porData.set(data, atual)
    })

    const historico: DiaDemanda[] = listarDatas(inicio, hoje).map((data) => {
      const demanda = porData.get(data) ?? { pedidos: 0, kg: 0 }
      const contexto = contextoCalendario(data, eventos)
      return {
        data, pedidos: demanda.pedidos, kg: demanda.kg, diaSemana: diaSemanaIso(data),
        evento: contexto.evento, contexto: contexto.texto, contextoTipo: contexto.tipo,
      }
    })

    const temporada = estimarAltaTemporada(historico, hoje)
    const baseKg = (dia: DiaDemanda) => dia.kg / (emAltaTemporada(dia.data) ? temporada.kg.valor : 1)
    const basePedidos = (dia: DiaDemanda) => dia.pedidos / (emAltaTemporada(dia.data) ? temporada.pedidos.valor : 1)
    const porSemana = DIAS_SEMANA.map((nome, diaSemana) => {
      const dias = historico.filter((dia) => dia.diaSemana === diaSemana)
      return {
        nome, diaSemana, amostras: dias.length,
        mediaKg: media(dias.map((dia) => dia.kg)),
        baseKg: media(dias.map(baseKg)), basePedidos: media(dias.map(basePedidos)),
        chanceDemanda: dias.length ? dias.filter((dia) => dia.kg > 0).length / dias.length : 0,
      }
    })

    const ultimos45Inicio = somarDiasIso(hoje, -44)
    const anteriores45Inicio = somarDiasIso(hoje, -89)
    const recente = historico.filter((dia) => dia.data >= ultimos45Inicio)
    const anterior = historico.filter((dia) => dia.data >= anteriores45Inicio && dia.data < ultimos45Inicio)
    const tendencia = media(anterior.map(baseKg)) > 0
      ? limitar(media(recente.map(baseKg)) / media(anterior.map(baseKg)), 0.7, 1.5)
      : 1

    const fatorContexto = (tipo: DiaDemanda['contextoTipo'], padrao: number) => {
      const dias = historico.filter((dia) => dia.contextoTipo === tipo)
      const razoes = dias.map((dia) => {
        const base = porSemana[dia.diaSemana].baseKg
        return base > 0 ? baseKg(dia) / base : 1
      })
      const pesoDados = razoes.length / (razoes.length + 5)
      return limitar(media(razoes) * pesoDados + padrao * (1 - pesoDados), 0.35, 2.2)
    }
    const fatores = {
      feriado: fatorContexto('feriado', 0.55),
      facultativo: fatorContexto('facultativo', 0.7),
      antes: fatorContexto('antes', 1.08),
      depois: fatorContexto('depois', 1.2),
    }

    const futurasBase = listarDatas(somarDiasIso(hoje, 1), fimPrevisao).map((data) => {
      const diaSemana = diaSemanaIso(data)
      const semana = porSemana[diaSemana]
      const contexto = contextoCalendario(data, eventos)
      const multiplicador = contexto.tipo ? fatores[contexto.tipo] : 1
      const verao = emAltaTemporada(data)
      const kgPrevisto = semana.baseKg * tendencia * multiplicador * (verao ? temporada.kg.valor : 1)
      const pedidosPrevistos = semana.basePedidos * tendencia * multiplicador * (verao ? temporada.pedidos.valor : 1)
      const sazonalidadeEstimada = verao && (temporada.kg.provisao || temporada.pedidos.provisao)
      return {
        data, diaSemana, pedidos: 0, kg: 0, evento: contexto.evento,
        contexto: contexto.texto, contextoTipo: contexto.tipo,
        kgPrevisto, pedidosPrevistos,
        confianca: sazonalidadeEstimada || semana.amostras < 6 ? 'baixa' as const : semana.amostras >= 12 ? 'alta' as const : 'média' as const,
      }
    })
    const valores = futurasBase.map((dia) => dia.kgPrevisto).sort((a, b) => a - b)
    const corteBaixo = valores[Math.floor(valores.length * 0.34)] ?? 0
    const corteAlto = valores[Math.floor(valores.length * 0.67)] ?? 0
    const previsoes: Previsao[] = futurasBase.map((dia) => ({
      ...dia,
      nivel: dia.kgPrevisto >= corteAlto ? 'Alta' : dia.kgPrevisto <= corteBaixo ? 'Baixa' : 'Média',
    }))

    const topHistorico = historico.filter((dia) => dia.kg > 0).sort((a, b) => b.kg - a.kg).slice(0, 15)
    const topPrevisao = [...previsoes].sort((a, b) => b.kgPrevisto - a.kgPrevisto).slice(0, 15)
    const diasComDemanda = historico.filter((dia) => dia.kg > 0)
    return {
      hoje, inicio, historico, porSemana, topHistorico, previsoes, topPrevisao, tendencia, temporada,
      totalKg: diasComDemanda.reduce((soma, dia) => soma + dia.kg, 0),
      maiorDia: topHistorico[0] ?? null,
      mediaDiaAtivo: media(diasComDemanda.map((dia) => dia.kg)),
      feriadosAnalisados: historico.filter((dia) => dia.contextoTipo === 'feriado').length,
    }
  }, [pedidos, horizonte])

  if (loading) return <div className="panel"><div className="panelBody hint">Calculando projeção de demanda…</div></div>
  if (erro) return <div className="panel"><div className="panelBody" style={{ color: 'var(--danger)' }}>{erro}</div></div>
  if (!pedidos.length) return <div className="panel"><div className="panelBody hint">Ainda não há pedidos suficientes para criar uma projeção.</div></div>

  const maxSemana = Math.max(...analise.porSemana.map((dia) => dia.mediaKg), 1)
  const tendenciaTexto = analise.tendencia > 1.05 ? 'em alta' : analise.tendencia < 0.95 ? 'em queda' : 'estável'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PLANEJAMENTO OPERACIONAL</span>
          <h1>Projeção de demanda</h1>
          <p>Histórico real de lavagens e previsão baseada no calendário brasileiro, em horário de Brasília.</p>
        </div>
        <label className={styles.horizon}>
          Ver próximos
          <select value={horizonte} onChange={(e) => setHorizonte(Number(e.target.value))}>
            <option value={30}>30 dias</option>
            <option value={60}>60 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>180 dias</option>
          </select>
        </label>
      </header>

      <div className={styles.notice}>
        <strong>Alta temporada em Arraial do Cabo</strong> · De dezembro a fevereiro, a previsão considera o aumento de movimento nas férias escolares junto com o dia da semana, os feriados e a tendência recente.
        <div>Histórico para comparação: {analise.temporada.diasVerao} dias de alta temporada e {analise.temporada.diasFora} dias fora dela.
          {' '}Ajuste sobre a demanda habitual: {(['kg', 'pedidos'] as const).map(campo => {
            const ajuste = analise.temporada[campo]
            return `${campo} × ${ajuste.valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} (${ajuste.provisao ? 'hipótese inicial' : 'histórico'})`
          }).join(' · ')}. O cálculo passa a usar as médias registradas a partir de quatro semanas em cada período, com volume para comparação.</div>
      </div>

      <section className={styles.kpis}>
        <article><span>Período analisado</span><strong>{formatarData(analise.inicio)} a {formatarData(analise.hoje)}</strong><small>{analise.feriadosAnalisados} feriados nacionais no período</small></article>
        <article><span>Maior dia registrado</span><strong>{analise.maiorDia ? `${arredondar(analise.maiorDia.kg)} kg` : '—'}</strong><small>{analise.maiorDia ? `${formatarData(analise.maiorDia.data)} · ${analise.maiorDia.pedidos} pedidos` : 'Sem dados'}</small></article>
        <article><span>Média em dia com trabalho</span><strong>{arredondar(analise.mediaDiaAtivo)} kg</strong><small>Somente dias que tiveram demanda</small></article>
        <article><span>Tendência recente</span><strong className={analise.tendencia >= 1 ? styles.positive : styles.negative}>{tendenciaTexto}</strong><small>{arredondar((analise.tendencia - 1) * 100, 0)}% versus os 45 dias anteriores</small></article>
      </section>

      <section className={styles.gridTwo}>
        <div className={styles.panel}>
          <div className={styles.panelTitle}><div><h2>Padrão por dia da semana</h2><p>Média incluindo dias sem pedidos</p></div></div>
          <div className={styles.weekList}>
            {analise.porSemana.map((dia) => (
              <div className={styles.weekRow} key={dia.nome}>
                <span className={styles.weekName}>{dia.nome}</span>
                <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.max(2, dia.mediaKg / maxSemana * 100)}%` }} /></div>
                <strong>{arredondar(dia.mediaKg)} kg</strong>
                <small>{Math.round(dia.chanceDemanda * 100)}% com demanda</small>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelTitle}><div><h2>Dias futuros mais prováveis</h2><p>Maiores volumes estimados nos próximos {horizonte} dias</p></div></div>
          <div className={styles.futureCards}>
            {analise.topPrevisao.slice(0, 6).map((dia, indice) => (
              <article key={dia.data}>
                <span className={styles.rank}>{indice + 1}</span>
                <div><strong>{formatarData(dia.data)} · {DIAS_SEMANA[dia.diaSemana]}</strong><small>{descricaoCalendario(dia)}</small></div>
                <div className={styles.forecastValue}><strong>{arredondar(dia.kgPrevisto)} kg</strong><small>~{arredondar(dia.pedidosPrevistos, 0)} pedidos</small></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><h2>Maiores demandas anteriores</h2><p>Para analisar os dias que já tiveram mais trabalho</p></div></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Data</th><th>Dia</th><th>Calendário</th><th>Pedidos</th><th>Lavado</th></tr></thead>
            <tbody>{analise.topHistorico.map((dia) => (
              <tr key={dia.data}>
                <td data-label="Data"><strong>{formatarData(dia.data)}</strong></td>
                <td data-label="Dia">{DIAS_SEMANA[dia.diaSemana]}</td>
                <td data-label="Calendário" className={styles.calendarCell}><span className={`${styles.badge} ${badgeClass(dia.contextoTipo)}`}>{descricaoCalendario(dia)}</span></td>
                <td data-label="Pedidos">{dia.pedidos}</td>
                <td data-label="Lavado"><strong>{arredondar(dia.kg)} kg</strong></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}><div><h2>Calendário futuro de trabalho</h2><p>Em ordem cronológica, com a demanda provável e alertas de feriados nacionais</p></div></div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Data</th><th>Dia</th><th>Calendário</th><th>Nível</th><th>Kg previstos</th><th>Pedidos</th><th>Confiança</th></tr></thead>
            <tbody>{analise.previsoes.map((dia) => (
              <tr key={dia.data} className={dia.nivel === 'Alta' ? styles.highRow : undefined}>
                <td data-label="Data"><strong>{formatarData(dia.data)}</strong></td>
                <td data-label="Dia">{DIAS_SEMANA[dia.diaSemana]}</td>
                <td data-label="Calendário" className={styles.calendarCell}><span className={`${styles.badge} ${badgeClass(dia.contextoTipo)}`}>{descricaoCalendario(dia)}</span></td>
                <td data-label="Nível"><span className={`${styles.level} ${styles[`level${dia.nivel}`]}`}>{dia.nivel}</span></td>
                <td data-label="Kg previstos"><strong>{arredondar(dia.kgPrevisto)} kg</strong></td>
                <td data-label="Pedidos">~{arredondar(dia.pedidosPrevistos, 0)}</td>
                <td data-label="Confiança">{dia.confianca}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <footer className={styles.footnote}>Calendário nacional: feriados federais e pontos facultativos. Feriados estaduais e municipais não estão incluídos. Última referência: {formatarData(analise.hoje)}.</footer>
    </div>
  )
}
