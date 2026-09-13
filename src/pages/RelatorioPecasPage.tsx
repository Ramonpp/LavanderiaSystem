import { useEffect, useMemo, useState } from 'react'
import { fetchItensPorPedidos, fetchPedidosPorPeriodo } from '../data/pedidos'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { ItemPedido, PedidoCliente, TipoPeca } from '../types/models'
import { monthBoundsLocal } from '../lib/dates'
import { StatusBanner } from '../components/StatusBanner'

function monthDefault() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMes(v: string) {
  const [ano, mes] = v.split('-').map(Number)
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${nomes[mes - 1] ?? ''} ${ano}`
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', flex: '1 1 170px' }}>
    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--muted)' }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 750, marginTop: 7 }}>{value}</div>
    {sub && <div className="hint" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </div>
}

export function RelatorioPecasPage() {
  const [mes, setMes] = useState(monthDefault)
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [tipos, setTipos] = useState<TipoPeca[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const periodo = useMemo(() => {
    const [ano, numeroMes] = mes.split('-').map(Number)
    return monthBoundsLocal(ano, numeroMes)
  }, [mes])

  async function carregar() {
    setLoading(true)
    setErro(null)
    const [pedidosRes, tiposRes] = await Promise.all([
      fetchPedidosPorPeriodo({ inicioIsoDate: periodo.start, fimIsoDate: periodo.end }),
      fetchTiposPeca(),
    ])
    const itensRes = await fetchItensPorPedidos(pedidosRes.data.map(p => p.id))
    setPedidos(pedidosRes.data)
    setTipos(tiposRes.data)
    setItens(itensRes.data)
    setErro(pedidosRes.error ?? tiposRes.error ?? itensRes.error ?? null)
    setLoading(false)
  }

  useEffect(() => { void carregar() }, [mes])

  const analise = useMemo(() => {
    const pedidosAtivos = pedidos.filter(p => p.status !== 'cancelado')
    const idsAtivos = new Set(pedidosAtivos.map(p => p.id))
    const pedidoPorId = new Map(pedidosAtivos.map(p => [p.id, p]))
    const nomeTipo = new Map(tipos.map(t => [t.id, t.nome]))
    const porTipo = new Map<string, { nome: string; quantidade: number; pedidos: Set<string>; clientes: Set<string> }>()
    const porCliente = new Map<string, { nome: string; quantidade: number; pedidos: Set<string>; tipos: Map<string, number> }>()
    const porDia = new Map<string, number>()

    itens.filter(i => idsAtivos.has(i.pedido_id)).forEach(i => {
      const pedido = pedidoPorId.get(i.pedido_id)
      if (!pedido) return
      const quantidade = Number(i.quantidade) || 0
      const tipoNome = nomeTipo.get(i.tipo_peca_id) ?? 'Tipo de peça removido'
      const clienteId = pedido.cliente?.id ?? pedido.cliente_id
      const clienteNome = pedido.cliente?.nome ?? 'Cliente não encontrado'
      const tipo = porTipo.get(i.tipo_peca_id) ?? { nome: tipoNome, quantidade: 0, pedidos: new Set<string>(), clientes: new Set<string>() }
      tipo.quantidade += quantidade; tipo.pedidos.add(pedido.id); tipo.clientes.add(clienteId); porTipo.set(i.tipo_peca_id, tipo)
      const cliente = porCliente.get(clienteId) ?? { nome: clienteNome, quantidade: 0, pedidos: new Set<string>(), tipos: new Map<string, number>() }
      cliente.quantidade += quantidade; cliente.pedidos.add(pedido.id); cliente.tipos.set(tipoNome, (cliente.tipos.get(tipoNome) ?? 0) + quantidade); porCliente.set(clienteId, cliente)
      porDia.set(pedido.data_pedido, (porDia.get(pedido.data_pedido) ?? 0) + quantidade)
    })

    const listaTipos = [...porTipo.values()].sort((a, b) => b.quantidade - a.quantidade)
    const listaClientes = [...porCliente.values()].map(c => {
      const principal = [...c.tipos.entries()].sort((a, b) => b[1] - a[1])[0]
      return { ...c, principal: principal ? `${principal[0]} (${principal[1]})` : '—' }
    }).sort((a, b) => b.quantidade - a.quantidade)
    const totalPecas = listaTipos.reduce((total, tipo) => total + tipo.quantidade, 0)
    const diaPico = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0]
    return { pedidosAtivos, listaTipos, listaClientes, totalPecas, diaPico }
  }, [pedidos, itens, tipos])

  return <div className="grid" style={{ gap: 16 }}>
    <header className="row" style={{ alignItems: 'end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <div>
        <h1 style={{ fontSize: 22, letterSpacing: -.2, marginBottom: 2 }}>Relatório de Peças</h1>
        <div className="hint">Volume de cada tipo de roupa e consumo por cliente.</div>
      </div>
      <div className="field" style={{ minWidth: 200, margin: 0 }}>
        <label htmlFor="relatorio-pecas-mes">Mês</label>
        <input id="relatorio-pecas-mes" type="month" value={mes} onChange={e => setMes(e.target.value)} />
      </div>
    </header>

    {erro && <StatusBanner kind="error" message={erro} />}
    {loading && <div className="hint" style={{ textAlign: 'center', padding: 12 }}>Carregando relatório...</div>}

    <section className="panel">
      <div className="panelHeader"><h2 style={{ fontSize: 15 }}>Visão geral — {formatMes(mes)}</h2></div>
      <div className="panelBody"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Kpi label="Peças registradas" value={String(analise.totalPecas)} sub="Soma das quantidades informadas nos pedidos" />
        <Kpi label="Pedidos com peças" value={String(analise.pedidosAtivos.length)} sub={`${analise.listaClientes.length} cliente(s) atendido(s)`} />
        <Kpi label="Tipos lavados" value={String(analise.listaTipos.length)} sub={analise.listaTipos[0] ? `Mais frequente: ${analise.listaTipos[0].nome}` : 'Sem itens no período'} />
        <Kpi label="Média por pedido" value={analise.pedidosAtivos.length ? (analise.totalPecas / analise.pedidosAtivos.length).toFixed(1) : '0'} sub="Peças por pedido ativo" />
        <Kpi label="Dia de maior volume" value={analise.diaPico ? `${analise.diaPico[1]} peças` : '—'} sub={analise.diaPico ? new Date(`${analise.diaPico[0]}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem dados'} />
      </div></div>
    </section>

    <section className="panel">
      <div className="panelHeader"><h2 style={{ fontSize: 15 }}>Quantidade por tipo de peça</h2></div>
      <div className="panelBody" style={{ overflowX: 'auto' }}>
        {analise.listaTipos.length === 0 ? <div className="hint">Não há peças registradas neste período.</div> : <table className="table"><thead><tr><th>Tipo de peça</th><th>Quantidade</th><th>Participação</th><th>Pedidos</th><th>Clientes</th></tr></thead><tbody>
          {analise.listaTipos.map(tipo => <tr key={tipo.nome}><td style={{ fontWeight: 600 }}>{tipo.nome}</td><td>{tipo.quantidade}</td><td>{analise.totalPecas ? ((tipo.quantidade / analise.totalPecas) * 100).toFixed(1) : '0'}%</td><td>{tipo.pedidos.size}</td><td>{tipo.clientes.size}</td></tr>)}
        </tbody></table>}
      </div>
    </section>

    <section className="panel">
      <div className="panelHeader"><h2 style={{ fontSize: 15 }}>Volume de peças por cliente</h2></div>
      <div className="panelBody" style={{ overflowX: 'auto' }}>
        {analise.listaClientes.length === 0 ? <div className="hint">Não há clientes com peças registradas neste período.</div> : <table className="table"><thead><tr><th>Cliente</th><th>Total de peças</th><th>Pedidos</th><th>Peça mais frequente</th><th>Média por pedido</th></tr></thead><tbody>
          {analise.listaClientes.map(cliente => <tr key={cliente.nome}><td style={{ fontWeight: 600 }}>{cliente.nome}</td><td>{cliente.quantidade}</td><td>{cliente.pedidos.size}</td><td>{cliente.principal}</td><td>{(cliente.quantidade / cliente.pedidos.size).toFixed(1)}</td></tr>)}
        </tbody></table>}
      </div>
    </section>
  </div>
}
