import { useEffect, useMemo, useState } from 'react'
import { fetchItensPorPedidos, fetchPedidosPorPeriodo } from '../data/pedidos'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { ItemPedido, PedidoCliente, TipoPeca } from '../types/models'
import { monthBoundsLocal } from '../lib/dates'
import { StatusBanner } from '../components/StatusBanner'

type Periodo = 'mensal' | 'anual'
type Filtros = { cliente: string; tipo: string; quantidadeMinima: string; pedidosMinimos: string }

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function mesAtual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function anoAtual() { return String(new Date().getFullYear()) }
function formatarData(iso: string) { return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR') }

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', flex: '1 1 165px' }}>
    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)' }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 750, marginTop: 7 }}>{value}</div>
    {sub && <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </div>
}

export function RelatorioPecasPage() {
  const [modo, setModo] = useState<Periodo>('mensal')
  const [mes, setMes] = useState(mesAtual)
  const [ano, setAno] = useState(anoAtual)
  const [filtros, setFiltros] = useState<Filtros>({ cliente: '', tipo: '', quantidadeMinima: '', pedidosMinimos: '' })
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [tipos, setTipos] = useState<TipoPeca[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const periodo = useMemo(() => {
    if (modo === 'anual') return { inicio: `${ano}-01-01`, fim: `${ano}-12-31`, titulo: `Ano de ${ano}` }
    const [numeroAno, numeroMes] = mes.split('-').map(Number)
    const limite = monthBoundsLocal(numeroAno, numeroMes)
    return { inicio: limite.start, fim: limite.end, titulo: `${meses[numeroMes - 1]} ${numeroAno}` }
  }, [modo, mes, ano])

  async function carregar() {
    setLoading(true); setErro(null)
    const [pedidosRes, tiposRes] = await Promise.all([
      fetchPedidosPorPeriodo({ inicioIsoDate: periodo.inicio, fimIsoDate: periodo.fim }), fetchTiposPeca(),
    ])
    const itensRes = await fetchItensPorPedidos(pedidosRes.data.map(p => p.id))
    setPedidos(pedidosRes.data); setTipos(tiposRes.data); setItens(itensRes.data)
    setErro(pedidosRes.error ?? tiposRes.error ?? itensRes.error ?? null); setLoading(false)
  }

  useEffect(() => { void carregar() }, [periodo.inicio, periodo.fim])

  const opcoesClientes = useMemo(() => [...new Map(pedidos.filter(p => p.status !== 'cancelado').map(p => [p.cliente_id, p.cliente?.nome ?? 'Cliente não encontrado'])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [pedidos])

  const analise = useMemo(() => {
    const quantidadeMinima = Math.max(0, Number(filtros.quantidadeMinima) || 0)
    const pedidosMinimos = Math.max(0, Number(filtros.pedidosMinimos) || 0)
    const tipoNome = new Map(tipos.map(t => [t.id, t.nome]))
    const pedidosAtivos = pedidos.filter(p => p.status !== 'cancelado' && (!filtros.cliente || p.cliente_id === filtros.cliente))
    const porPedido = new Map(pedidosAtivos.map(p => [p.id, p]))
    const registros = itens.filter(i => porPedido.has(i.pedido_id) && (!filtros.tipo || i.tipo_peca_id === filtros.tipo)).map(i => ({
      item: i, pedido: porPedido.get(i.pedido_id)!, quantidade: Number(i.quantidade) || 0, nomeTipo: tipoNome.get(i.tipo_peca_id) ?? 'Tipo de peça removido',
    }))
    const porTipo = new Map<string, { id: string; nome: string; quantidade: number; pedidos: Set<string>; clientes: Set<string> }>()
    const porCliente = new Map<string, { id: string; nome: string; quantidade: number; pedidos: Set<string>; tipos: Map<string, number> }>()
    const porDia = new Map<string, { quantidade: number; pedidos: Set<string>; clientes: Set<string>; tipos: Map<string, number> }>()
    registros.forEach(({ item, pedido, quantidade, nomeTipo }) => {
      const clienteId = pedido.cliente?.id ?? pedido.cliente_id; const clienteNome = pedido.cliente?.nome ?? 'Cliente não encontrado'
      const tipo = porTipo.get(item.tipo_peca_id) ?? { id: item.tipo_peca_id, nome: nomeTipo, quantidade: 0, pedidos: new Set<string>(), clientes: new Set<string>() }
      tipo.quantidade += quantidade; tipo.pedidos.add(pedido.id); tipo.clientes.add(clienteId); porTipo.set(item.tipo_peca_id, tipo)
      const cliente = porCliente.get(clienteId) ?? { id: clienteId, nome: clienteNome, quantidade: 0, pedidos: new Set<string>(), tipos: new Map<string, number>() }
      cliente.quantidade += quantidade; cliente.pedidos.add(pedido.id); cliente.tipos.set(nomeTipo, (cliente.tipos.get(nomeTipo) ?? 0) + quantidade); porCliente.set(clienteId, cliente)
      const dia = porDia.get(pedido.data_pedido) ?? { quantidade: 0, pedidos: new Set<string>(), clientes: new Set<string>(), tipos: new Map<string, number>() }
      dia.quantidade += quantidade; dia.pedidos.add(pedido.id); dia.clientes.add(clienteId); dia.tipos.set(nomeTipo, (dia.tipos.get(nomeTipo) ?? 0) + quantidade); porDia.set(pedido.data_pedido, dia)
    })
    const listaTipos = [...porTipo.values()].filter(x => x.quantidade >= quantidadeMinima && x.pedidos.size >= pedidosMinimos).sort((a, b) => b.quantidade - a.quantidade)
    const listaClientes = [...porCliente.values()].filter(x => x.quantidade >= quantidadeMinima && x.pedidos.size >= pedidosMinimos).map(x => ({ ...x, principal: [...x.tipos.entries()].sort((a, b) => b[1] - a[1])[0] })).sort((a, b) => b.quantidade - a.quantidade)
    const listaDias = [...porDia.entries()].filter(([, x]) => x.quantidade >= quantidadeMinima && x.pedidos.size >= pedidosMinimos).map(([data, x]) => ({ data, ...x, tiposTexto: [...x.tipos.entries()].sort((a, b) => b[1] - a[1]).map(([nome, quantidade]) => `${quantidade}× ${nome}`).join(', ') })).sort((a, b) => b.data.localeCompare(a.data))
    const totalPecas = registros.reduce((s, x) => s + x.quantidade, 0)
    const pedidosComItens = new Set(registros.map(x => x.pedido.id)).size
    const pico = [...porDia.entries()].sort((a, b) => b[1].quantidade - a[1].quantidade)[0]
    return { listaTipos, listaClientes, listaDias, totalPecas, pedidosComItens, pico, tiposDiferentes: porTipo.size, clientesDiferentes: porCliente.size }
  }, [pedidos, itens, tipos, filtros])

  function atualizarFiltro(campo: keyof Filtros, valor: string) { setFiltros(atual => ({ ...atual, [campo]: valor })) }
  function limparFiltros() { setFiltros({ cliente: '', tipo: '', quantidadeMinima: '', pedidosMinimos: '' }) }

  return <div className="grid" style={{ gap: 16 }}>
    <header className="row" style={{ alignItems: 'end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <div><h1 style={{ fontSize: 22, letterSpacing: -.2, marginBottom: 2 }}>Relatório de Peças</h1><div className="hint">Analise o volume, os tipos de roupa e o comportamento dos clientes.</div></div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0, minWidth: 145 }}><label htmlFor="periodo-relatorio-pecas">Período</label><select id="periodo-relatorio-pecas" value={modo} onChange={e => setModo(e.target.value as Periodo)}><option value="mensal">Mensal</option><option value="anual">Anual</option></select></div>
        {modo === 'mensal' ? <div className="field" style={{ margin: 0, minWidth: 160 }}><label htmlFor="mes-relatorio-pecas">Mês</label><input id="mes-relatorio-pecas" type="month" value={mes} onChange={e => setMes(e.target.value)} /></div> : <div className="field" style={{ margin: 0, minWidth: 120 }}><label htmlFor="ano-relatorio-pecas">Ano</label><input id="ano-relatorio-pecas" type="number" min="2020" max="2100" value={ano} onChange={e => setAno(e.target.value)} /></div>}
      </div>
    </header>

    <section className="panel"><div className="panelHeader"><h2 style={{ fontSize: 15 }}>Filtros de análise</h2><button className="btn btnSecondary" type="button" onClick={limparFiltros}>Limpar filtros</button></div><div className="panelBody"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <div className="field" style={{ margin: 0 }}><label htmlFor="filtro-cliente-pecas">Cliente</label><select id="filtro-cliente-pecas" value={filtros.cliente} onChange={e => atualizarFiltro('cliente', e.target.value)}><option value="">Todos os clientes</option>{opcoesClientes.map(([id, nome]) => <option value={id} key={id}>{nome}</option>)}</select></div>
      <div className="field" style={{ margin: 0 }}><label htmlFor="filtro-tipo-pecas">Tipo de peça</label><select id="filtro-tipo-pecas" value={filtros.tipo} onChange={e => atualizarFiltro('tipo', e.target.value)}><option value="">Todos os tipos</option>{tipos.map(tipo => <option value={tipo.id} key={tipo.id}>{tipo.nome}</option>)}</select></div>
      <div className="field" style={{ margin: 0 }}><label htmlFor="filtro-quantidade-pecas">Quantidade mínima</label><input id="filtro-quantidade-pecas" type="number" min="0" placeholder="Ex.: 10" value={filtros.quantidadeMinima} onChange={e => atualizarFiltro('quantidadeMinima', e.target.value)} /></div>
      <div className="field" style={{ margin: 0 }}><label htmlFor="filtro-pedidos-pecas">Pedidos mínimos</label><input id="filtro-pedidos-pecas" type="number" min="0" placeholder="Ex.: 2" value={filtros.pedidosMinimos} onChange={e => atualizarFiltro('pedidosMinimos', e.target.value)} /></div>
    </div></div></section>

    {erro && <StatusBanner kind="error" message={erro} />}
    {loading && <div className="hint" style={{ textAlign: 'center', padding: 12 }}>Carregando relatório...</div>}

    <section className="panel"><div className="panelHeader"><h2 style={{ fontSize: 15 }}>Visão geral — {periodo.titulo}</h2></div><div className="panelBody"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <Kpi label="Peças registradas" value={String(analise.totalPecas)} sub="Soma dos itens no período" /><Kpi label="Pedidos com peças" value={String(analise.pedidosComItens)} sub={`${analise.clientesDiferentes} cliente(s)`} /><Kpi label="Tipos lavados" value={String(analise.tiposDiferentes)} sub={analise.listaTipos[0] ? `Mais frequente: ${analise.listaTipos[0].nome}` : 'Sem dados'} /><Kpi label="Média por pedido" value={analise.pedidosComItens ? (analise.totalPecas / analise.pedidosComItens).toFixed(1) : '0'} sub="Peças por pedido" /><Kpi label="Dia de maior volume" value={analise.pico ? `${analise.pico[1].quantidade} peças` : '—'} sub={analise.pico ? formatarData(analise.pico[0]) : 'Sem dados'} />
    </div></div></section>

    <section className="panel"><div className="panelHeader"><h2 style={{ fontSize: 15 }}>Quantidade por tipo de peça</h2></div><div className="panelBody" style={{ overflowX: 'auto' }}>{analise.listaTipos.length === 0 ? <div className="hint">Não há resultados para estes filtros.</div> : <table className="table"><thead><tr><th>Tipo de peça</th><th>Quantidade</th><th>Participação</th><th>Pedidos</th><th>Clientes</th></tr></thead><tbody>{analise.listaTipos.map(tipo => <tr key={tipo.id}><td style={{ fontWeight: 600 }}>{tipo.nome}</td><td>{tipo.quantidade}</td><td>{analise.totalPecas ? ((tipo.quantidade / analise.totalPecas) * 100).toFixed(1) : '0'}%</td><td>{tipo.pedidos.size}</td><td>{tipo.clientes.size}</td></tr>)}</tbody></table>}</div></section>

    <section className="panel"><div className="panelHeader"><h2 style={{ fontSize: 15 }}>Peças recebidas por dia</h2></div><div className="panelBody" style={{ overflowX: 'auto' }}><div className="hint" style={{ marginBottom: 10 }}>Veja em quais dias cada tipo de peça entrou para organizar a operação.</div>{analise.listaDias.length === 0 ? <div className="hint">Não há resultados para estes filtros.</div> : <table className="table"><thead><tr><th>Data</th><th>Total de peças</th><th>Pedidos</th><th>Clientes</th><th>Tipos de peça recebidos</th></tr></thead><tbody>{analise.listaDias.map(dia => <tr key={dia.data}><td style={{ fontWeight: 600 }}>{formatarData(dia.data)}</td><td>{dia.quantidade}</td><td>{dia.pedidos.size}</td><td>{dia.clientes.size}</td><td>{dia.tiposTexto}</td></tr>)}</tbody></table>}</div></section>

    <section className="panel"><div className="panelHeader"><h2 style={{ fontSize: 15 }}>Volume de peças por cliente</h2></div><div className="panelBody" style={{ overflowX: 'auto' }}>{analise.listaClientes.length === 0 ? <div className="hint">Não há resultados para estes filtros.</div> : <table className="table"><thead><tr><th>Cliente</th><th>Total de peças</th><th>Pedidos</th><th>Peça mais frequente</th><th>Média por pedido</th></tr></thead><tbody>{analise.listaClientes.map(cliente => <tr key={cliente.id}><td style={{ fontWeight: 600 }}>{cliente.nome}</td><td>{cliente.quantidade}</td><td>{cliente.pedidos.size}</td><td>{cliente.principal ? `${cliente.principal[0]} (${cliente.principal[1]})` : '—'}</td><td>{(cliente.quantidade / cliente.pedidos.size).toFixed(1)}</td></tr>)}</tbody></table>}</div></section>
  </div>
}
