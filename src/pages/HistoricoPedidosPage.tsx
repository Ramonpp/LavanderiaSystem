import { useEffect, useMemo, useState } from 'react'
import { fetchClientes } from '../data/clientes'
import { fetchPedidos, fetchItensPorPedidos } from '../data/pedidos'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { Cliente, PedidoCliente, ItemPedido, TipoPeca } from '../types/models'
import { receitaPedido } from '../domain/finance'
import { formatBRL, normalizeSearch } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'

export function HistoricoPedidosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [itensMap, setItensMap] = useState<Record<string, ItemPedido[]>>({})

  const [loading, setLoading] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Seleção múltipla de clientes
  const [selectedClienteIds, setSelectedClienteIds] = useState<Set<string>>(new Set())
  const [buscaCliente, setBuscaCliente] = useState('')

  // Filtro de período
  const hoje = new Date().toISOString().slice(0, 10)
  const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes)
  const [dataFim, setDataFim] = useState(hoje)

  // Resultados filtrados
  const [pedidosFiltrados, setPedidosFiltrados] = useState<PedidoCliente[]>([])
  const [itensMapFiltrado, setItensMapFiltrado] = useState<Record<string, ItemPedido[]>>({})

  async function carregarDados() {
    setLoading(true)
    setErro(null)
    try {
      const [cliRes, pedRes, tipoRes] = await Promise.all([
        fetchClientes(true),
        fetchPedidos(),
        fetchTiposPeca(),
      ])
      if (cliRes.error) { setErro(cliRes.error); return }
      if (pedRes.error) { setErro(pedRes.error); return }
      if (tipoRes.error) { setErro(tipoRes.error); return }

      setClientes(cliRes.data)
      setPedidos(pedRes.data)
      setTiposPeca(tipoRes.data)

      // Carrega itens de todos os pedidos
      if (pedRes.data.length > 0) {
        const ids = pedRes.data.map((p) => p.id)
        const itensRes = await fetchItensPorPedidos(ids)
        if (!itensRes.error) {
          const grouped: Record<string, ItemPedido[]> = {}
          pedRes.data.forEach((p) => {
            grouped[p.id] = itensRes.data.filter((it) => it.pedido_id === p.id)
          })
          setItensMap(grouped)
        }
      }
    } catch (err: any) {
      setErro(`Erro ao carregar dados: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void carregarDados() }, [])

  function getPecaNome(tipoPecaId: string): string {
    return tiposPeca.find((t) => t.id === tipoPecaId)?.nome || 'Peça'
  }

  function formatarLocal(c: Cliente) {
    const parts = []
    if (c.condominio?.trim()) parts.push(c.condominio.trim())
    if (c.bloco?.trim()) parts.push(`Bl. ${c.bloco.trim()}`)
    if (c.apartamento?.trim()) parts.push(`Ap. ${c.apartamento.trim()}`)
    return parts.length > 0 ? parts.join(' - ') : '—'
  }

  // Clientes filtrados pela busca
  const clientesFiltrados = useMemo(() => {
    const termo = normalizeSearch(buscaCliente)
    if (!termo) return clientes
    return clientes.filter((c) => {
      const nome = normalizeSearch(c.nome)
      const cond = normalizeSearch(c.condominio || '')
      const ap = normalizeSearch(c.apartamento || '')
      return nome.includes(termo) || cond.includes(termo) || ap.includes(termo)
    })
  }, [clientes, buscaCliente])

  function handleToggleCliente(id: string) {
    setSelectedClienteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelectAll() {
    const allVisible = clientesFiltrados.map((c) => c.id)
    const allSelected = allVisible.every((id) => selectedClienteIds.has(id))
    setSelectedClienteIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        allVisible.forEach((id) => next.delete(id))
      } else {
        allVisible.forEach((id) => next.add(id))
      }
      return next
    })
  }

  function buscarHistorico() {
    if (selectedClienteIds.size === 0) {
      setErro('Selecione ao menos um cliente.')
      return
    }
    if (!dataInicio || !dataFim) {
      setErro('Informe o período de busca.')
      return
    }
    setBuscando(true)
    setErro(null)

    const resultado = pedidos.filter((p) => {
      if (!selectedClienteIds.has(p.cliente_id)) return false
      if (p.data_pedido < dataInicio || p.data_pedido > dataFim) return false
      return true
    }).sort((a, b) => a.data_pedido.localeCompare(b.data_pedido))

    const novoItensMap: Record<string, ItemPedido[]> = {}
    resultado.forEach((p) => {
      novoItensMap[p.id] = itensMap[p.id] || []
    })

    setPedidosFiltrados(resultado)
    setItensMapFiltrado(novoItensMap)
    setBuscando(false)
  }

  // Calcular totais por cliente nos resultados
  const resumoPorCliente = useMemo(() => {
    const map: Record<string, { cliente: Cliente | null; pedidos: PedidoCliente[]; pesoTotal: number; valorTotal: number }> = {}
    pedidosFiltrados.forEach((p) => {
      if (!map[p.cliente_id]) {
        const cli = clientes.find((c) => c.id === p.cliente_id) || null
        map[p.cliente_id] = { cliente: cli, pedidos: [], pesoTotal: 0, valorTotal: 0 }
      }
      map[p.cliente_id].pedidos.push(p)
      map[p.cliente_id].pesoTotal += Number(p.peso_kg || 0)
      map[p.cliente_id].valorTotal += receitaPedido(p)
    })
    return Object.values(map)
  }, [pedidosFiltrados, clientes])

  const totalGeral = useMemo(() => ({
    pedidos: pedidosFiltrados.length,
    peso: pedidosFiltrados.reduce((s, p) => s + Number(p.peso_kg || 0), 0),
    valor: pedidosFiltrados.reduce((s, p) => s + receitaPedido(p), 0),
  }), [pedidosFiltrados])

  function handleGerarPDF() {
    if (pedidosFiltrados.length === 0) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const baseUrl = window.location.origin

    const clientesSelecionadosNomes = resumoPorCliente
      .map((r) => r.cliente?.nome || '—')
      .join(', ')

    const periodoStr = `${new Date(`${dataInicio}T00:00:00`).toLocaleDateString('pt-BR')} a ${new Date(`${dataFim}T00:00:00`).toLocaleDateString('pt-BR')}`

    // Gera seção por cliente
    const secoesPorCliente = resumoPorCliente.map((r) => {
      const linhas = r.pedidos.map((p) => {
        const [ano, mes, dia] = p.data_pedido.split('-')
        const dataFmt = `${dia}/${mes}/${ano}`
        const valor = receitaPedido(p)
        const itens = itensMapFiltrado[p.id] || []
        const pecas = itens.map((it) => `${it.quantidade}x ${getPecaNome(it.tipo_peca_id)}`).join(', ') || '—'
        return `
          <tr>
            <td>${dataFmt}</td>
            <td>${pecas}</td>
            <td style="text-align:right">${Number(p.peso_kg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
            <td style="text-align:right;font-weight:600;color:#3b6fe8">${formatBRL(valor)}</td>
          </tr>`
      }).join('')

      const localStr = r.cliente ? formatarLocal(r.cliente as unknown as Cliente) : '—'

      return `
        <div class="cliente-section">
          <div class="cliente-header">
            <strong>${r.cliente?.nome || '—'}</strong>
            <span>${localStr}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:14%">Data</th>
                <th>Peças Lavadas</th>
                <th style="width:16%;text-align:right">Peso</th>
                <th style="width:18%;text-align:right">Valor</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
          <div class="subtotal">
            <span>Subtotal: ${r.pedidos.length} envios</span>
            <span>Peso: ${r.pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span>
            <strong style="color:#3b6fe8">Total: ${formatBRL(r.valorTotal)}</strong>
          </div>
        </div>`
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Histórico de Pedidos</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #333; background: #fff; margin: 0; padding: 20px; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b6fe8; padding-bottom: 14px; margin-bottom: 20px; }
          .brand-name { font-size: 22px; font-weight: 800; color: #3b6fe8; margin: 0; }
          .brand-sub { font-size: 11px; color: #666; margin: 0; text-transform: uppercase; }
          .doc-title { font-size: 17px; font-weight: 700; text-align: right; margin: 0; }
          .doc-sub { font-size: 12px; color: #666; text-align: right; margin: 3px 0 0; }
          .info-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
          .info-bar strong { color: #1a202c; }
          .cliente-section { margin-bottom: 30px; page-break-inside: avoid; }
          .cliente-header { border-left: 4px solid #3b6fe8; padding-left: 10px; margin-bottom: 8px; }
          .cliente-header strong { display: block; font-size: 15px; color: #1a202c; }
          .cliente-header span { font-size: 12px; color: #718096; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th { background: #3b6fe8; color: #fff; font-size: 11px; text-align: left; padding: 8px 10px; text-transform: uppercase; letter-spacing: 0.4px; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          tr:nth-child(even) td { background: #f8fafc; }
          .subtotal { display: flex; justify-content: flex-end; gap: 24px; background: #edf2f7; padding: 8px 14px; border-radius: 6px; font-size: 13px; margin-top: -4px; }
          .total-geral { display: flex; justify-content: flex-end; gap: 30px; background: #1a202c; color: #fff; padding: 12px 20px; border-radius: 8px; margin-top: 20px; margin-bottom: 30px; }
          .total-geral div { text-align: right; }
          .total-label { font-size: 10px; color: #a0aec0; text-transform: uppercase; margin-bottom: 2px; }
          .total-value { font-size: 18px; font-weight: 700; }
          .payment-box { background: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 14px; margin-top: 16px; }
          .payment-box h4 { margin: 0 0 6px; color: #2b6cb0; font-size: 14px; }
          .footer-note { text-align: center; font-size: 10px; color: #a0aec0; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print { .no-print { display: none !important; } @page { margin: 1.2cm; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom:16px">
          <button onclick="window.close()" style="padding:8px 14px;font-size:13px;background:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-weight:600">⬅ Voltar</button>
        </div>
        <div class="header">
          <div>
            <img src="${baseUrl}/logo.png" alt="Logo" style="width:38px;height:38px;object-fit:contain;vertical-align:middle;margin-right:10px" onerror="this.style.display='none'">
            <h1 class="brand-name" style="display:inline-block;vertical-align:middle">Ciclo Novo</h1>
            <p class="brand-sub">Lavanderia</p>
          </div>
          <div>
            <h2 class="doc-title">Histórico de Pedidos</h2>
            <p class="doc-sub">Período: ${periodoStr}</p>
            <p class="doc-sub">Emitido em: ${dataEmissao}</p>
          </div>
        </div>

        <div class="info-bar">
          <strong>Clientes:</strong> ${clientesSelecionadosNomes}
        </div>

        ${secoesPorCliente}

        <div class="total-geral">
          <div>
            <div class="total-label">Total de Envios</div>
            <div class="total-value">${totalGeral.pedidos}</div>
          </div>
          <div>
            <div class="total-label">Peso Total</div>
            <div class="total-value">${totalGeral.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</div>
          </div>
          <div>
            <div class="total-label">Valor Total</div>
            <div class="total-value" style="color:#68d391">${formatBRL(totalGeral.valor)}</div>
          </div>
        </div>

        <div class="payment-box">
          <h4>Dados para Pagamento via PIX</h4>
          <p style="margin:0;font-weight:600">Beneficiário: Ramon Pereira Paixão</p>
          <p style="margin:4px 0 0;font-weight:bold;color:#3b6fe8;font-size:15px">Chave PIX (CNPJ): 59.815.300/0001-71</p>
        </div>

        <p class="footer-note">Ciclo Novo Lavanderia · Histórico gerado em ${dataEmissao}</p>

        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 500); }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12 }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Carregando histórico...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const todosVisivelSelecionados = clientesFiltrados.length > 0 && clientesFiltrados.every((c) => selectedClienteIds.has(c.id))

  return (
    <div className="grid" style={{ gap: 14 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Histórico de Pedidos</h1>
        <div className="hint">Selecione um ou mais clientes e o período para consultar o histórico e gerar o PDF.</div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Coluna esquerda: seleção de clientes */}
        <section className="panel">
          <div className="panelHeader" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <h2 style={{ fontSize: 15, color: 'var(--accent)', margin: 0 }}>Clientes</h2>
            <span className="hint" style={{ fontSize: 12 }}>{selectedClienteIds.size} selecionado(s)</span>
          </div>
          <div className="panelBody" style={{ gap: 10 }}>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, width: '100%' }}
            />
            {/* Selecionar todos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                id="select-all-hist"
                checked={todosVisivelSelecionados}
                onChange={handleSelectAll}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="select-all-hist" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--muted)' }}>
                Selecionar todos ({clientesFiltrados.length})
              </label>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', display: 'grid', gap: 4 }}>
              {clientesFiltrados.map((c) => {
                const isSelected = selectedClienteIds.has(c.id)
                return (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-bg)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--accent-border)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleCliente(c.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.nome}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {formatarLocal(c)}
                      </div>
                    </div>
                  </label>
                )
              })}
              {clientesFiltrados.length === 0 && (
                <div className="hint" style={{ textAlign: 'center', padding: '20px 0' }}>Nenhum cliente encontrado.</div>
              )}
            </div>
          </div>
        </section>

        {/* Coluna direita: período + buscar */}
        <section className="panel" style={{ alignSelf: 'start' }}>
          <div className="panelHeader" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <h2 style={{ fontSize: 15, color: 'var(--accent)', margin: 0 }}>Período</h2>
          </div>
          <div className="panelBody" style={{ gap: 14 }}>
            <div className="field">
              <label htmlFor="hist-inicio">Data início</label>
              <input
                id="hist-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="hist-fim">Data fim</label>
              <input
                id="hist-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>

            {/* Atalhos de período */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Este mês', action: () => {
                  const n = new Date()
                  setDataInicio(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10))
                  setDataFim(n.toISOString().slice(0, 10))
                }},
                { label: 'Mês passado', action: () => {
                  const n = new Date()
                  const ini = new Date(n.getFullYear(), n.getMonth() - 1, 1)
                  const fim = new Date(n.getFullYear(), n.getMonth(), 0)
                  setDataInicio(ini.toISOString().slice(0, 10))
                  setDataFim(fim.toISOString().slice(0, 10))
                }},
                { label: 'Últimos 3 meses', action: () => {
                  const n = new Date()
                  const ini = new Date(n.getFullYear(), n.getMonth() - 2, 1)
                  setDataInicio(ini.toISOString().slice(0, 10))
                  setDataFim(n.toISOString().slice(0, 10))
                }},
                { label: 'Este ano', action: () => {
                  const n = new Date()
                  setDataInicio(`${n.getFullYear()}-01-01`)
                  setDataFim(n.toISOString().slice(0, 10))
                }},
              ].map((atalho) => (
                <button
                  key={atalho.label}
                  type="button"
                  onClick={atalho.action}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  {atalho.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btnPrimary"
              onClick={buscarHistorico}
              disabled={buscando || selectedClienteIds.size === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4 }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Buscar Histórico
            </button>
          </div>
        </section>
      </div>

      {/* Resultados */}
      {pedidosFiltrados.length > 0 && (
        <section className="panel">
          <div className="panelHeader" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 16, color: 'var(--accent)', margin: 0 }}>
                Resultados — {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'}
              </h2>
              <div className="hint" style={{ fontSize: 12, marginTop: 2 }}>
                Peso total: <strong>{totalGeral.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</strong> &nbsp;·&nbsp;
                Valor total: <strong style={{ color: 'var(--ok)' }}>{formatBRL(totalGeral.valor)}</strong>
              </div>
            </div>
            <button
              type="button"
              className="btn btnPrimary"
              onClick={handleGerarPDF}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Gerar PDF
            </button>
          </div>
          <div className="panelBody" style={{ gap: 20 }}>
            {resumoPorCliente.map((r) => (
              <div key={r.cliente?.id || 'unknown'}>
                {/* Cabeçalho do cliente */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--accent-bg)',
                  border: '1px solid var(--accent-border)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 8,
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 14 }}>{r.cliente?.nome || '—'}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
                      {r.cliente ? formatarLocal(r.cliente as unknown as Cliente) : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    <span className="hint" style={{ fontSize: 12 }}>
                      {r.pedidos.length} envio(s)
                    </span>
                    <span className="hint" style={{ fontSize: 12 }}>
                      {r.pesoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg
                    </span>
                    <strong style={{ color: 'var(--ok)', fontSize: 13 }}>{formatBRL(r.valorTotal)}</strong>
                  </div>
                </div>
                {/* Tabela de pedidos do cliente */}
                <div className="tableWrap" style={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Peças Lavadas</th>
                        <th style={{ textAlign: 'right' }}>Peso</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.pedidos.map((p) => {
                        const itens = itensMapFiltrado[p.id] || []
                        return (
                          <tr key={p.id}>
                            <td>{new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {itens.length === 0 ? (
                                  <span className="hint" style={{ fontSize: 11 }}>—</span>
                                ) : itens.map((it) => (
                                  <span key={it.id} style={{ fontSize: 11, fontWeight: 600, background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 5 }}>
                                    {it.quantidade}x {getPecaNome(it.tipo_peca_id)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>{Number(p.peso_kg).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-h)' }}>{formatBRL(receitaPedido(p))}</td>
                            <td>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '2px 7px',
                                borderRadius: 5,
                                background: p.status === 'entregue' ? 'color-mix(in srgb, var(--ok), transparent 85%)' : 'color-mix(in srgb, var(--muted), transparent 85%)',
                                color: p.status === 'entregue' ? 'var(--ok)' : 'var(--muted)',
                              }}>
                                {p.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Total geral */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 32,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 20px',
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Envios</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-h)' }}>{totalGeral.pedidos}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Peso Total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-h)' }}>{totalGeral.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>Valor Total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ok)' }}>{formatBRL(totalGeral.valor)}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {pedidosFiltrados.length === 0 && !loading && selectedClienteIds.size > 0 && (
        <div className="panel" style={{ padding: '30px 20px', textAlign: 'center', borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
          <h3 style={{ fontSize: 16, color: 'var(--text-h)', marginBottom: 6 }}>Nenhum pedido encontrado</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Não há pedidos para os clientes selecionados no período informado.</p>
        </div>
      )}
    </div>
  )
}
