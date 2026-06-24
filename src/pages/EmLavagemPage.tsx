import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosEmLavagem, fetchItensPorPedidos, updatePedido, updateItemPedido } from '../data/pedidos'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { PedidoCliente, ItemPedido, TipoPeca, ItemPedidoPeca, OrderStatus } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'

export function EmLavagemPage() {
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [itensMap, setItensMap] = useState<Record<string, ItemPedido[]>>({})
  const [tipos, setTipos] = useState<TipoPeca[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  // Carrega todos os dados necessários
  async function loadData() {
    setLoading(true)
    setErro(null)
    try {
      const [pedidosRes, tiposRes] = await Promise.all([
        fetchPedidosEmLavagem(),
        fetchTiposPeca(),
      ])

      if (pedidosRes.error) {
        setErro(pedidosRes.error)
        setLoading(false)
        return
      }
      if (tiposRes.error) {
        setErro(tiposRes.error)
        setLoading(false)
        return
      }

      const activePedidos = pedidosRes.data
      setPedidos(activePedidos)
      setTipos(tiposRes.data)

      if (activePedidos.length > 0) {
        const pedidoIds = activePedidos.map((p) => p.id)
        const itensRes = await fetchItensPorPedidos(pedidoIds)
        if (itensRes.error) {
          setErro(itensRes.error)
        } else {
          // Agrupa os itens por pedido_id
          const grouped: Record<string, ItemPedido[]> = {}
          activePedidos.forEach((p) => {
            grouped[p.id] = itensRes.data.filter((item) => item.pedido_id === p.id)
          })
          setItensMap(grouped)
        }
      } else {
        setItensMap({})
      }
    } catch (err: any) {
      setErro(`Erro ao carregar dados: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Resolve o nome do tipo de peça
  function getPecaNome(tipoPecaId: string): string {
    return tipos.find((t) => t.id === tipoPecaId)?.nome || 'Peça desconhecida'
  }

  // Formata o cabeçalho do cliente
  function formatarNomeCliente(c: PedidoCliente['cliente']) {
    if (!c) return '—'
    const parts = []
    if (c.apartamento?.trim()) parts.push(`Ap ${c.apartamento.trim()}`)
    if (c.bloco?.trim()) parts.push(`Bloco ${c.bloco.trim()}`)
    if (c.condominio?.trim()) parts.push(c.condominio.trim())
    return parts.length > 0 ? `${c.nome} (${parts.join(' - ')})` : c.nome
  }

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim()
    if (!termo) return pedidos
    return pedidos.filter((p) => {
      const nomeCliente = formatarNomeCliente(p.cliente).toLowerCase()
      return nomeCliente.includes(termo)
    })
  }, [pedidos, busca])

  // Alterna o estado 'conferido' de uma peça específica
  async function handleTogglePeca(pedidoId: string, itemId: string, pecaIndex: number) {
    const orderItems = itensMap[pedidoId] || []
    const item = orderItems.find((it) => it.id === itemId)
    if (!item) return

    // Garante que o array de peças existe e tem o tamanho correto
    const currentPecas = [...(item.pecas || [])]
    const resolvedPecas: ItemPedidoPeca[] = Array.from({ length: item.quantidade }, (_, i) => {
      return currentPecas[i] || { id_peca: 'Sem ID', conferido: false }
    })

    // Alterna o estado
    resolvedPecas[pecaIndex] = {
      ...resolvedPecas[pecaIndex],
      conferido: !resolvedPecas[pecaIndex].conferido,
    }

    // Atualiza o estado local temporariamente para resposta imediata na UI
    setItensMap((prev) => {
      const updatedItems = prev[pedidoId].map((it) => {
        if (it.id === itemId) {
          return { ...it, pecas: resolvedPecas }
        }
        return it
      })
      return { ...prev, [pedidoId]: updatedItems }
    })

    // Salva no Supabase
    const { error } = await updateItemPedido(itemId, { pecas: resolvedPecas })
    if (error) {
      setErro(`Erro ao atualizar peça: ${error}`)
      // Reverte o estado se falhar
      void loadData()
    }
  }

  // Verifica se todas as peças de todos os itens de um pedido estão conferidas
  const statusConferenciaPedidos = useMemo(() => {
    const statusMap: Record<string, { total: number; conferidas: number; finalizado: boolean }> = {}

    pedidos.forEach((p) => {
      const orderItems = itensMap[p.id] || []
      let total = 0
      let conferidas = 0

      orderItems.forEach((item) => {
        total += item.quantidade
        const pecasList = item.pecas || []
        for (let i = 0; i < item.quantidade; i++) {
          if (pecasList[i]?.conferido) {
            conferidas++
          }
        }
      });

      statusMap[p.id] = {
        total,
        conferidas,
        finalizado: total > 0 && total === conferidas,
      }
    })

    return statusMap
  }, [pedidos, itensMap])

  // Altera o status do pedido para "Pronto"
  async function handleFinalizarPedido(pedidoId: string) {
    setErro(null)
    setMsg(null)
    const { error } = await updatePedido(pedidoId, { status: 'pronto' as OrderStatus })
    if (error) {
      setErro(`Erro ao finalizar pedido: ${error}`)
    } else {
      setMsg('Pedido marcado como pronto e enviado para expedição!')
      // Remove do estado local para evitar recarga de tela completa
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoId))
      setItensMap((prev) => {
        const copy = { ...prev }
        delete copy[pedidoId]
        return copy
      })
    }
  }

  if (loading && pedidos.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12 }}>
        <div style={{
          width: '28px',
          height: '28px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Carregando peças em lavagem...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Em Lavagem</h1>
          <div className="hint">Conferência individual das peças do enxoval por cliente. Clique nas peças para marcar como conferidas/dobradas.</div>
        </div>
        <button className="btn" type="button" onClick={() => void loadData()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Atualizar</span>
        </button>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      {/* Busca */}
      {(pedidos.length > 0 || busca) && (
        <div className="row" style={{ gap: 12, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 4 }}>
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto' }}>
            <div className="field" style={{ minWidth: 240, flex: '1 1 auto' }}>
              <label htmlFor="busca-cliente" style={{ marginBottom: 4 }}>Buscar Cliente</label>
              <input
                id="busca-cliente"
                type="text"
                placeholder="Digite o nome do cliente, condomínio, ap..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              />
            </div>
          </div>
          <div className="hint" style={{ fontWeight: 600 }}>
            {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido em lavagem' : 'pedidos em lavagem'}
          </div>
        </div>
      )}

      {pedidosFiltrados.length === 0 ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--panel)', borderRadius: '16px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧺</div>
          <h3 style={{ fontSize: 18, color: 'var(--text-h)', marginBottom: 6 }}>Nenhum pedido em lavagem</h3>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            {busca ? 'Nenhum pedido encontrado com este termo.' : 'Todos os enxovais já foram conferidos ou não há novos pedidos cadastrados.'}
          </p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 16 }}>
          {pedidosFiltrados.map((p) => {
            const conf = statusConferenciaPedidos[p.id] || { total: 0, conferidas: 0, finalizado: false }
            const listItens = itensMap[p.id] || []

            return (
              <article
                key={p.id}
                className="panel"
                style={{
                  border: conf.finalizado ? '2px solid var(--ok)' : '1px solid var(--border)',
                  boxShadow: conf.finalizado ? '0 4px 20px -2px rgba(16, 185, 129, 0.12)' : 'var(--shadow)',
                  transition: 'all 0.3s ease',
                  borderRadius: '16px'
                }}
              >
                {/* Header do Card */}
                <div
                  className="panelHeader"
                  style={{
                    background: conf.finalizado ? 'color-mix(in srgb, var(--ok), transparent 95%)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    padding: '14px 16px',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <div style={{ flex: '1 1 auto' }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{formatarNomeCliente(p.cliente)}</span>
                      {conf.finalizado && (
                        <span style={{
                          background: 'var(--ok)',
                          color: '#fff',
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          ✓ Concluído
                        </span>
                      )}
                    </h2>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      <span className="hint" style={{ fontSize: 12 }}>
                        Data: <strong>{new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR')}</strong>
                      </span>
                      <span className="hint" style={{ fontSize: 12 }}>
                        Peso: <strong>{Number(p.peso_kg).toLocaleString('pt-BR')} kg</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: conf.finalizado ? 'var(--ok)' : 'var(--muted)' }}>
                      Conferência: {conf.conferidas}/{conf.total} ({conf.total > 0 ? Math.round((conf.conferidas / conf.total) * 100) : 0}%)
                    </span>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void handleFinalizarPedido(p.id)}
                      disabled={!conf.finalizado}
                      style={{
                        background: conf.finalizado ? 'var(--ok)' : 'transparent',
                        color: conf.finalizado ? '#fff' : 'var(--muted)',
                        border: conf.finalizado ? 'none' : '1px solid var(--border)',
                        fontWeight: 600,
                        fontSize: 13,
                        padding: '8px 16px',
                        cursor: conf.finalizado ? 'pointer' : 'not-allowed',
                        boxShadow: conf.finalizado ? '0 2px 8px rgba(16, 185, 129, 0.25)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Marcar como concluído
                    </button>
                  </div>
                </div>

                {/* Corpo do Card - Itens e Peças */}
                <div className="panelBody" style={{ padding: 16, display: 'grid', gap: 14 }}>
                  {listItens.length === 0 ? (
                    <div className="hint" style={{ padding: '10px 0' }}>Este pedido não possui detalhes de peças cadastrados.</div>
                  ) : (
                    listItens.map((item) => {
                      const pecasList = item.pecas || []
                      return (
                        <div
                          key={item.id}
                          style={{
                            background: 'var(--bg)',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            border: '1px solid var(--border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-h)', fontSize: 14 }}>
                              {getPecaNome(item.tipo_peca_id)}
                            </span>
                            <span className="hint" style={{ fontSize: 12, fontWeight: 500 }}>
                              Qtd: {item.quantidade}
                            </span>
                          </div>

                          {/* Grid de peças clicáveis */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                            {Array.from({ length: item.quantidade }).map((_, idx) => {
                              const peca = pecasList[idx] || { id_peca: 'Sem ID', conferido: false }
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => void handleTogglePeca(p.id, item.id, idx)}
                                  style={{
                                    display: 'inline-flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    border: peca.conferido ? '1px solid var(--ok)' : '1px solid var(--border)',
                                    background: peca.conferido ? 'color-mix(in srgb, var(--ok), transparent 90%)' : 'var(--panel)',
                                    color: peca.conferido ? 'var(--ok)' : 'var(--text-h)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    outline: 'none',
                                    boxShadow: peca.conferido ? '0 2px 6px rgba(16, 185, 129, 0.08)' : 'none',
                                    textAlign: 'center'
                                  }}
                                  title={peca.conferido ? 'Clique para desmarcar' : 'Clique para marcar como conferido/dobrado'}
                                >
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', fontSize: 12 }}>
                                    {peca.id_peca || 'Sem ID'}
                                  </span>
                                  <span style={{ fontSize: 10, fontWeight: 500, color: peca.conferido ? 'var(--ok)' : 'var(--muted)', marginTop: 2 }}>
                                    {peca.conferido ? '✓ Dobrado' : 'Pendente'}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })
                  )}

                  {/* Banner de Sinalização de Sucesso */}
                  {conf.finalizado && (
                    <div
                      style={{
                        background: 'color-mix(in srgb, var(--ok), transparent 90%)',
                        border: '1px solid var(--ok)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        animation: 'pulse 2s infinite'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ok)', fontWeight: 700, fontSize: 14 }}>
                        <span style={{ fontSize: 20 }}>🎉</span>
                        <span>Todas as peças conferidas e dobradas com sucesso!</span>
                      </div>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => void handleFinalizarPedido(p.id)}
                        style={{
                          background: 'var(--ok)',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '6px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        Marcar como concluído
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
