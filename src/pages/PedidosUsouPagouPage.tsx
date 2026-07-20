import { useEffect, useMemo, useState } from 'react'
import { fetchClientes } from '../data/clientes'
import { fetchPedidos, fetchItensPorPedidos } from '../data/pedidos'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { Cliente, PedidoCliente, ItemPedido, TipoPeca } from '../types/models'
import { receitaPedido } from '../domain/finance'
import { formatBRL, normalizeSearch } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'
import { jsPDF } from 'jspdf'

function getBase64Image(imgUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imgUrl
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } else {
        resolve(imgUrl)
      }
    }
    img.onerror = () => {
      resolve(imgUrl)
    }
  })
}

// Desenha um retângulo arredondado no Canvas 2D
function roundRectU(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// Quebra texto em linhas para caber na largura máxima
function wrapTextU(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : [text]
}

export function PedidosUsouPagouPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [itensMap, setItensMap] = useState<Record<string, ItemPedido[]>>({})
  
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null)
  const [chavePix, setChavePix] = useState(() => {
    try { return localStorage.getItem('lav-chave-pix') || '' } catch { return '' }
  })

  // Estado para múltiplos clientes selecionados
  const [selectedClientesIds, setSelectedClientesIds] = useState<Set<string>>(new Set())

  function handleChavePixChange(val: string) {
    setChavePix(val)
    try { localStorage.setItem('lav-chave-pix', val) } catch { /* noop */ }
  }

  async function carregarDados() {
    setLoading(true)
    setErro(null)
    try {
      const [cliRes, pedRes, tipoRes] = await Promise.all([
        fetchClientes(false), // Apenas ativos
        fetchPedidos(),
        fetchTiposPeca(),
      ])

      if (cliRes.error) {
        setErro(cliRes.error)
        return
      }
      if (pedRes.error) {
        setErro(pedRes.error)
        return
      }
      if (tipoRes.error) {
        setErro(tipoRes.error)
        return
      }

      // Filtra clientes plano usou e pagou ("pagou")
      const usouPagou = cliRes.data.filter((c) => c.plano === 'pagou')
      setClientes(usouPagou)

      // Filtra pedidos não pagos dos clientes usou e pagou
      const usouPagouIds = new Set(usouPagou.map((c) => c.id))
      const pedidosUsouPagou = pedRes.data.filter(
        (p) => usouPagouIds.has(p.cliente_id) && p.pagamento_status !== 'pago' && p.status !== 'cancelado'
      )
      setPedidos(pedidosUsouPagou)
      setTiposPeca(tipoRes.data)

      // Carrega os itens dos pedidos encontrados
      if (pedidosUsouPagou.length > 0) {
        const orderIds = pedidosUsouPagou.map((p) => p.id)
        const itensRes = await fetchItensPorPedidos(orderIds)
        if (itensRes.error) {
          setErro(itensRes.error)
        } else {
          const grouped: Record<string, ItemPedido[]> = {}
          pedidosUsouPagou.forEach((p) => {
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
    void carregarDados()
  }, [])

  // Agrupa os pedidos por cliente
  const usouPagouComPendencia = useMemo(() => {
    const termo = normalizeSearch(busca)
    
    return clientes
      .map((c) => {
        const pedidosCliente = pedidos.filter((p) => p.cliente_id === c.id)
        const pesoTotal = pedidosCliente.reduce((sum, p) => sum + Number(p.peso_kg || 0), 0)
        const valorTotal = pedidosCliente.reduce((sum, p) => sum + receitaPedido(p), 0)
        
        return {
          cliente: c,
          pedidos: pedidosCliente,
          pesoTotal,
          valorTotal,
        }
      })
      .filter((item) => {
        // Mostra apenas quem tem pedidos devendo
        if (item.pedidos.length === 0) return false
        
        // Filtra por busca
        if (termo) {
          const nome = normalizeSearch(item.cliente.nome)
          const cond = normalizeSearch(item.cliente.condominio || '')
          return nome.includes(termo) || cond.includes(termo)
        }
        return true
      })
  }, [clientes, pedidos, busca])

  // Limpa IDs de clientes selecionados se eles não estiverem mais na lista visível filtrada
  useEffect(() => {
    const visiveisIds = new Set(usouPagouComPendencia.map(item => item.cliente.id))
    setSelectedClientesIds(prev => {
      const next = new Set<string>()
      prev.forEach(id => {
        if (visiveisIds.has(id)) next.add(id)
      })
      return next
    })
  }, [usouPagouComPendencia])

  function formatarLocal(c: Cliente) {
    const parts = []
    if (c.condominio?.trim()) parts.push(c.condominio.trim())
    if (c.bloco?.trim()) parts.push(`Bloco ${c.bloco.trim()}`)
    if (c.apartamento?.trim()) parts.push(`Ap ${c.apartamento.trim()}`)
    return parts.length > 0 ? parts.join(' - ') : '—'
  }

  function getPecaNome(tipoPecaId: string): string {
    return tiposPeca.find((t) => t.id === tipoPecaId)?.nome || 'Peça'
  }

  // Alternar seleção de cliente específico
  function handleToggleSelect(clienteId: string) {
    setSelectedClientesIds((prev) => {
      const next = new Set(prev)
      if (next.has(clienteId)) {
        next.delete(clienteId)
      } else {
        next.add(clienteId)
      }
      return next
    })
  }

  // Alternar todos os visíveis
  const todosSelecionados = useMemo(() => {
    if (usouPagouComPendencia.length === 0) return false
    return usouPagouComPendencia.every((item) => selectedClientesIds.has(item.cliente.id))
  }, [usouPagouComPendencia, selectedClientesIds])

  function handleSelectAll() {
    if (todosSelecionados) {
      // Desmarcar todos os visíveis
      setSelectedClientesIds((prev) => {
        const next = new Set(prev)
        usouPagouComPendencia.forEach((item) => next.delete(item.cliente.id))
        return next
      })
    } else {
      // Marcar todos os visíveis
      setSelectedClientesIds((prev) => {
        const next = new Set(prev)
        usouPagouComPendencia.forEach((item) => next.add(item.cliente.id))
        return next
      })
    }
  }

  // Gera o link de cobrança do WhatsApp
  function handleCobrarWhatsApp(c: Cliente, pedidosCliente: PedidoCliente[], pesoTotal: number, valorTotal: number) {
    if (!c.telefone) return
    const fone = c.telefone.replace(/\D/g, '')
    const primeiroNome = c.nome.trim().split(' ')[0]
    
    // Constrói a lista de pedidos detalhada por data
    const listaDatas = pedidosCliente
      .slice()
      .reverse() // Do mais antigo ao mais recente
      .map((p) => {
        const [ano, mes, dia] = p.data_pedido.split('-')
        const dataFormatada = `${dia}/${mes}/${ano.slice(-2)}`
        const valor = receitaPedido(p)
        return `📅 ${dataFormatada}: ${p.peso_kg} kg - ${formatBRL(valor)}`
      })
      .join('\n')

    const texto = `Olá, ${primeiroNome}! 😊\n\n` +
      `Segue o detalhamento das suas lavagens em aberto no plano Usou e Pagou:\n\n` +
      `${listaDatas}\n\n` +
      `🧺 *Peso Total:* ${pesoTotal.toLocaleString('pt-BR')} kg\n` +
      `💰 *Valor Total:* ${formatBRL(valorTotal)}\n\n` +
      `Em seguida, enviaremos a chave Pix.\n\n` +
      `Abraços, Equipe Ciclo Novo Lavanderia 💙`

    const url = `https://api.whatsapp.com/send?phone=55${fone}&text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  // Copia a mensagem simplificada de cobrança para a área de transferência
  function handleCopiarMensagemPronta(c: Cliente) {
    const primeiroNome = c.nome.trim().split(' ')[0]
    
    const texto = `Olá, ${primeiroNome}! Tudo bem?\n\n` +
      `Segue o fechamento da lavanderia.\n\n` +
      `Qualquer dúvida estou à disposição! 💙`

    navigator.clipboard.writeText(texto).then(() => {
      setMsg(`Mensagem pronta para ${primeiroNome} copiada!`)
      setTimeout(() => setMsg(null), 4000)
    }).catch((err) => {
      setErro(`Erro ao copiar mensagem: ${err.message || err}`)
    })
  }

  // Gera o PDF ou PNG de fechamento formatado na tela de impressão para um ÚNICO cliente
  function handleGerarPDF(c: Cliente, pedidosCliente: PedidoCliente[], pesoTotal: number, valorTotal: number, isPng = false) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const detalhesPedidos = pedidosCliente
      .slice()
      .reverse()
      .map((p) => {
        const [ano, mes, dia] = p.data_pedido.split('-')
        const dataFormatada = `${dia}/${mes}/${ano}`
        const valor = receitaPedido(p)
        
        const itens = itensMap[p.id] || []
        const pecasDetalhadas = itens
          .map((it) => `${it.quantidade}x ${getPecaNome(it.tipo_peca_id)}`)
          .join(', ') || 'Sem especificações'

        return `
          <tr>
            <td>${dataFormatada}</td>
            <td>${pecasDetalhadas}</td>
            <td style="text-align: right;">${Number(p.peso_kg).toLocaleString('pt-BR')} kg</td>
            <td style="text-align: right; font-weight: 600;">${formatBRL(valor)}</td>
          </tr>
        `
      })
      .join('')

    const localStr = formatarLocal(c)
    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const baseUrl = window.location.origin

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Pendência - ${c.nome} ${c.apartamento ? `Apto ${c.apartamento}` : ''} ${c.bloco ? `Bloco ${c.bloco}` : ''}</title>
        ${isPng ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>' : ''}
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            background-color: #ffffff !important;
            margin: 0;
            padding: 20px;
            font-size: 14px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #3b6fe8;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .logo-img {
            width: 50px;
            height: 50px;
            object-fit: contain;
          }
          .brand-name {
            font-size: 22px;
            font-weight: 800;
            color: #3b6fe8;
            margin: 0;
          }
          .brand-sub {
            font-size: 11px;
            color: #666;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .doc-title {
            font-size: 18px;
            font-weight: 700;
            text-align: right;
            margin: 0;
            color: #333;
          }
          .doc-date {
            font-size: 12px;
            color: #666;
            text-align: right;
            margin-top: 4px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          }
          .info-block h3 {
            margin: 0 0 6px 0;
            font-size: 12px;
            text-transform: uppercase;
            color: #666;
            letter-spacing: 0.5px;
          }
          .info-block p {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: #1a202c;
          }
          .info-block span {
            display: block;
            font-size: 13px;
            color: #4a5568;
            margin-top: 2px;
            font-weight: 400;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #3b6fe8;
            color: white;
            font-weight: 600;
            text-align: left;
            padding: 10px 12px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
            color: #2d3748;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .totals-bar {
            display: flex;
            justify-content: flex-end;
            gap: 40px;
            background: #edf2f7;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 40px;
            border: 1px solid #cbd5e0;
          }
          .total-item {
            text-align: right;
          }
          .total-label {
            font-size: 11px;
            color: #4a5568;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .total-value {
            font-size: 18px;
            font-weight: 700;
            color: #1a202c;
          }
          .payment-instructions {
            background-color: #ebf8ff;
            border: 1px solid #bee3f8;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
          }
          .payment-instructions h4 {
            margin: 0 0 8px 0;
            color: #2b6cb0;
            font-size: 14px;
          }
          .payment-instructions p {
            margin: 0;
            font-size: 13px;
            color: #2d3748;
          }
          .footer-note {
            text-align: center;
            font-size: 11px;
            color: #a0aec0;
            margin-top: 50px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
          }
          @media print {
            @page {
              margin: 0;
            }
            body {
              margin: 1.6cm;
              padding: 0;
            }
            .payment-instructions {
              page-break-inside: avoid;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.close(); if(window.history.length > 1) { window.history.back(); } else { window.location.href = '${baseUrl}'; }" style="padding: 10px 16px; font-size: 14px; background-color: #e2e8f0; color: #1a202c; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
            ⬅ Voltar ao Aplicativo
          </button>
        </div>
        <div class="header">
          <div class="logo-container">
            <img src="${baseUrl}/logo.png" alt="Logo" class="logo-img" onerror="this.style.display='none'" style="width:40px;height:40px;object-fit:contain;" />
            <div>
              <h1 class="brand-name">Ciclo Novo</h1>
              <p class="brand-sub">Lavanderia</p>
            </div>
          </div>
          <div>
            <h2 class="doc-title">Pendência - ${c.nome} ${c.apartamento ? `Apto ${c.apartamento}` : ''} ${c.bloco ? `Bloco ${c.bloco}` : ''}</h2>
            <p class="doc-date">Emitido em: ${dataEmissao}</p>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-block">
            <h3>Cliente</h3>
            <p>${c.nome}</p>
            ${localStr !== '—' ? `<span>${localStr}</span>` : ''}
          </div>
          <div class="info-block">
            <h3>Contato</h3>
            <p>${c.telefone || 'Sem telefone'}</p>
            <span>Pagamento via: ${FORMA_PAGTO_LABELS[c.forma_pagamento] || c.forma_pagamento}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Data</th>
              <th style="width: 50%;">Peças Lavadas</th>
              <th style="width: 15%; text-align: right;">Peso</th>
              <th style="width: 20%; text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${detalhesPedidos}
          </tbody>
        </table>

        <div class="totals-bar">
          <div class="total-item">
            <div class="total-label">Quantidade de Envios</div>
            <div class="total-value">${pedidosCliente.length}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Peso Total</div>
            <div class="total-value">${Number(pesoTotal).toLocaleString('pt-BR')} kg</div>
          </div>
          <div class="total-item">
            <div class="total-label">Total a Pagar</div>
            <div class="total-value" style="color: #3b6fe8;">${formatBRL(valorTotal)}</div>
          </div>
        </div>

        <div class="payment-instructions">
          <h4>Dados para Pagamento via PIX</h4>
          <p style="margin: 0; font-weight: 600;">Beneficiário: Ramon Pereira Paixão</p>
          <p style="margin: 4px 0 0 0; font-weight: bold; color: #3b6fe8; font-size: 15px;">Chave PIX (CNPJ): 59.815.300/0001-71</p>
        </div>

        <p class="footer-note">Ciclo Novo Lavanderia · Higiene, Carinho e Sustentabilidade para suas Roupas</p>

        <script>
          window.onload = function() {
            setTimeout(function() {
              ${isPng 
                ? `
                html2canvas(document.body).then(function(canvas) {
                  var link = document.createElement('a');
                  link.download = 'cobranca-${c.nome.replace(/\s+/g, '-')}.png';
                  link.href = canvas.toDataURL();
                  link.click();
                  window.close();
                });
                ` 
                : 'window.print();'
              }
            }, 500);
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Copia a imagem PNG do fechamento — mesmo layout do PDF compartilhado
  async function handleCopiarPNG(c: Cliente, pedidosCliente: PedidoCliente[], pesoTotal: number, valorTotal: number) {
    try {
      setMsg('Gerando imagem para cópia...')

      const logoBase64 = await getBase64Image('/logo.png')
      const localStr = formatarLocal(c)
      const dataEmissao = new Date().toLocaleDateString('pt-BR')

      // ── Canvas 2D nativo — proporcional ao A4 ────────────
      const DPI   = 2
      const W     = 794 * DPI
      const H     = 1123 * DPI
      const MM    = W / 210

      const canvas = document.createElement('canvas')
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!
      ctx.scale(DPI, DPI)

      const BLUE  = '#3b6fe8'
      const DARK  = '#1a202c'
      const GRAY  = '#4a5568'
      const LGRAY = '#e2e8f0'
      const BGCARD= '#f8fafc'

      const mm = (v: number) => v * MM / DPI
      const ml = mm(14); const mr = mm(196); const cw = mr - ml

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 794, 1123)

      let cy = mm(14)

      const logo = new Image()
      logo.src = logoBase64
      await new Promise<void>((res) => { logo.onload = () => res(); logo.onerror = () => res() })
      try { ctx.drawImage(logo, ml, cy, mm(14), mm(14)) } catch { /* ignora */ }

      ctx.fillStyle = BLUE
      ctx.font = `bold ${mm(5.6)}px Arial, sans-serif`
      ctx.fillText('Ciclo Novo', ml + mm(17), cy + mm(6))
      ctx.fillStyle = GRAY
      ctx.font = `${mm(2.5)}px Arial, sans-serif`
      ctx.fillText('LAVANDERIA', ml + mm(17), cy + mm(11))

      const titleParts = [`Pendência - ${c.nome}`, c.apartamento ? `Apto ${c.apartamento}` : '', c.bloco ? `Bloco ${c.bloco}` : ''].filter(Boolean).join(' ')
      ctx.fillStyle = DARK
      ctx.font = `bold ${mm(3.9)}px Arial, sans-serif`
      const titleW = ctx.measureText(titleParts).width
      ctx.fillText(titleParts, mr - titleW, cy + mm(6))
      ctx.fillStyle = GRAY
      ctx.font = `${mm(2.8)}px Arial, sans-serif`
      const dateStr = `Emitido em: ${dataEmissao}`
      const dateW = ctx.measureText(dateStr).width
      ctx.fillText(dateStr, mr - dateW, cy + mm(11))

      cy += mm(18)
      ctx.strokeStyle = BLUE; ctx.lineWidth = mm(0.5)
      ctx.beginPath(); ctx.moveTo(ml, cy); ctx.lineTo(mr, cy); ctx.stroke()
      cy += mm(6)

      ctx.fillStyle = BGCARD
      ctx.strokeStyle = LGRAY; ctx.lineWidth = mm(0.3)
      roundRectU(ctx, ml, cy, cw, mm(20), mm(2))
      ctx.fill(); ctx.stroke()

      ctx.fillStyle = GRAY; ctx.font = `bold ${mm(2.5)}px Arial, sans-serif`
      ctx.fillText('CLIENTE', ml + mm(4), cy + mm(5))
      ctx.fillStyle = DARK; ctx.font = `bold ${mm(3.5)}px Arial, sans-serif`
      ctx.fillText(c.nome, ml + mm(4), cy + mm(11))
      if (localStr !== '—') {
        ctx.fillStyle = GRAY; ctx.font = `${mm(2.8)}px Arial, sans-serif`
        ctx.fillText(localStr, ml + mm(4), cy + mm(16))
      }
      const hx = ml + cw / 2 + mm(4)
      ctx.fillStyle = GRAY; ctx.font = `bold ${mm(2.5)}px Arial, sans-serif`
      ctx.fillText('CONTATO', hx, cy + mm(5))
      ctx.fillStyle = DARK; ctx.font = `bold ${mm(3.5)}px Arial, sans-serif`
      ctx.fillText(c.telefone || 'Sem telefone', hx, cy + mm(11))
      ctx.fillStyle = GRAY; ctx.font = `${mm(2.8)}px Arial, sans-serif`
      ctx.fillText(`Pagamento via: ${FORMA_PAGTO_LABELS[c.forma_pagamento] || c.forma_pagamento}`, hx, cy + mm(16))
      cy += mm(26)

      const colWmm = [26, cw/MM*DPI - 26 - 22 - 28, 22, 28].map(v => v < 30 ? mm(v) : cw - mm(26) - mm(22) - mm(28))
      const c0 = ml; const c1 = ml + mm(26); const c2 = ml + mm(26) + colWmm[1]; const c3 = c2 + mm(22)
      ctx.fillStyle = BLUE
      ctx.fillRect(ml, cy, cw, mm(7))
      ctx.fillStyle = '#ffffff'; ctx.font = `bold ${mm(2.5)}px Arial, sans-serif`
      ;['DATA', 'PEÇAS LAVADAS', 'PESO', 'VALOR'].forEach((h, i) => {
        const xs = [c0, c1, c2, c3]
        const ws = [mm(26), colWmm[1], mm(22), mm(28)]
        if (i >= 2) {
          ctx.fillText(h, xs[i] + ws[i] - ctx.measureText(h).width - mm(2), cy + mm(4.8))
        } else {
          ctx.fillText(h, xs[i] + mm(2), cy + mm(4.8))
        }
      })
      cy += mm(7)

      ;[...pedidosCliente].reverse().forEach((p, idx) => {
        const [ano, mes, dia] = p.data_pedido.split('-')
        const valor = receitaPedido(p)
        const pecas = (itensMap[p.id] || []).map((it) => `${it.quantidade}x ${getPecaNome(it.tipo_peca_id)}`).join(', ') || 'Sem especificações'
        ctx.font = `${mm(2.8)}px Arial, sans-serif`
        const pecasLines = wrapTextU(ctx, pecas, colWmm[1] - mm(4))
        const rowH = Math.max(mm(7), pecasLines.length * mm(4) + mm(3))
        if (idx % 2 === 0) { ctx.fillStyle = BGCARD; ctx.fillRect(ml, cy, cw, rowH) }
        ctx.strokeStyle = LGRAY; ctx.lineWidth = mm(0.2)
        ctx.beginPath(); ctx.moveTo(ml, cy + rowH); ctx.lineTo(mr, cy + rowH); ctx.stroke()
        ctx.fillStyle = DARK; ctx.font = `${mm(2.8)}px Arial, sans-serif`
        ctx.fillText(`${dia}/${mes}/${ano}`, c0 + mm(2), cy + mm(4.8))
        pecasLines.forEach((line, li) => ctx.fillText(line, c1 + mm(2), cy + mm(4.8) + li * mm(4)))
        const pt = `${Number(p.peso_kg).toLocaleString('pt-BR')} kg`
        ctx.fillText(pt, c2 + mm(22) - ctx.measureText(pt).width - mm(2), cy + mm(4.8))
        ctx.font = `bold ${mm(2.8)}px Arial, sans-serif`
        const vt = formatBRL(valor)
        ctx.fillText(vt, c3 + mm(28) - ctx.measureText(vt).width - mm(2), cy + mm(4.8))
        cy += rowH
      })
      cy += mm(6)

      ctx.fillStyle = '#edf2f7'; ctx.strokeStyle = '#cbd5e0'; ctx.lineWidth = mm(0.3)
      roundRectU(ctx, ml, cy, cw, mm(16), mm(2)); ctx.fill(); ctx.stroke()
      const tt1 = ml + cw * 0.33; const tt2 = ml + cw * 0.66; const tt3 = ml + cw
      ;[
        { label: 'QUANTIDADE DE ENVIOS', value: String(pedidosCliente.length), cx: ml + cw * 0.165 },
        { label: 'PESO TOTAL', value: `${Number(pesoTotal).toLocaleString('pt-BR')} kg`, cx: (tt1 + tt2) / 2 },
        { label: 'TOTAL A PAGAR', value: formatBRL(valorTotal), cx: (tt2 + tt3) / 2 },
      ].forEach((t) => {
        ctx.fillStyle = GRAY; ctx.font = `${mm(2.5)}px Arial, sans-serif`
        ctx.fillText(t.label, t.cx - ctx.measureText(t.label).width / 2, cy + mm(5))
        ctx.fillStyle = t.label === 'TOTAL A PAGAR' ? BLUE : DARK
        ctx.font = `bold ${mm(3.5)}px Arial, sans-serif`
        ctx.fillText(t.value, t.cx - ctx.measureText(t.value).width / 2, cy + mm(12))
      })
      ctx.strokeStyle = '#cbd5e0'; ctx.lineWidth = mm(0.3)
      ctx.beginPath(); ctx.moveTo(tt1, cy + mm(2)); ctx.lineTo(tt1, cy + mm(14)); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(tt2, cy + mm(2)); ctx.lineTo(tt2, cy + mm(14)); ctx.stroke()
      cy += mm(22)

      ctx.fillStyle = '#ebf8ff'; ctx.strokeStyle = '#bee3f8'; ctx.lineWidth = mm(0.3)
      roundRectU(ctx, ml, cy, cw, mm(22), mm(2)); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#2b6cb0'; ctx.font = `bold ${mm(3.2)}px Arial, sans-serif`
      ctx.fillText('Dados para Pagamento via PIX', ml + mm(4), cy + mm(7))
      ctx.fillStyle = DARK; ctx.font = `${mm(3)}px Arial, sans-serif`
      ctx.fillText('Beneficiário: Ramon Pereira Paixão', ml + mm(4), cy + mm(13))
      ctx.fillStyle = BLUE; ctx.font = `bold ${mm(3)}px Arial, sans-serif`
      ctx.fillText('Chave PIX (CNPJ): 59.815.300/0001-71', ml + mm(4), cy + mm(19))
      cy += mm(28)

      ctx.strokeStyle = LGRAY; ctx.lineWidth = mm(0.3)
      ctx.beginPath(); ctx.moveTo(ml, cy); ctx.lineTo(mr, cy); ctx.stroke()
      cy += mm(5)
      ctx.fillStyle = GRAY; ctx.font = `${mm(2.5)}px Arial, sans-serif`
      const footerText = 'Ciclo Novo Lavanderia · Higiene, Carinho e Sustentabilidade para suas Roupas'
      ctx.fillText(footerText, (794 - ctx.measureText(footerText).width) / 2, cy)

      canvas.toBlob((blob) => {
        if (!blob) { setErro('Falha ao gerar imagem.'); return }
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          .then(() => { setMsg('Imagem copiada com sucesso!'); setTimeout(() => setMsg(null), 4000) })
          .catch((err) => setErro(`Erro ao copiar: ${err.message || err}`))
      }, 'image/png')

    } catch (err: any) {
      setErro(`Erro ao processar imagem: ${err.message || err}`)
      setMsg(null)
    }
  }

  // Compartilha o fechamento em formato PDF usando a API nativa de compartilhamento (ideal para PWA no iOS)
  async function handleCompartilharPDF(c: Cliente, pedidosCliente: PedidoCliente[], pesoTotal: number, valorTotal: number) {
    try {
      setMsg('Preparando PDF para compartilhar...')

      const logoBase64 = await getBase64Image('/logo.png')
      const localStr = formatarLocal(c)
      const dataEmissao = new Date().toLocaleDateString('pt-BR')
      const primeiroNome = c.nome.trim().split(' ')[0]

      // ── Configurações da página ──────────────────────────
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const PW = 210
      const ML = 14
      const MR = 14
      const CW = PW - ML - MR
      let y = 14

      // ── Paleta ──────────────────────────────────────────
      const BLUE   = [59, 111, 232] as const
      const DARK   = [26, 32, 44]   as const
      const GRAY   = [74, 85, 104]  as const
      const LGRAY  = [226, 232, 240] as const
      const BGCARD = [248, 250, 252] as const

      const centeredText = (text: string, cx: number, cy: number) => {
        const w = pdf.getTextWidth(text)
        pdf.text(text, cx - w / 2, cy)
      }

      // ── LOGO + CABEÇALHO ────────────────────────────────
      try { pdf.addImage(logoBase64, 'PNG', ML, y, 14, 14) } catch { /* ignora */ }

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(16)
      pdf.setTextColor(...BLUE)
      pdf.text('Ciclo Novo', ML + 17, y + 6)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(...GRAY)
      pdf.text('LAVANDERIA', ML + 17, y + 11)

      // Título direita — inclui nome + apartamento + bloco
      const titleParts = [`Pendência - ${c.nome}`, c.apartamento ? `Apto ${c.apartamento}` : '', c.bloco ? `Bloco ${c.bloco}` : ''].filter(Boolean).join(' ')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...DARK)
      const titleW = pdf.getTextWidth(titleParts)
      pdf.text(titleParts, PW - MR - titleW, y + 6)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(...GRAY)
      const dateText = `Emitido em: ${dataEmissao}`
      const dateW = pdf.getTextWidth(dateText)
      pdf.text(dateText, PW - MR - dateW, y + 11)

      y += 18
      pdf.setDrawColor(...BLUE)
      pdf.setLineWidth(0.5)
      pdf.line(ML, y, PW - MR, y)
      y += 6

      // ── CARD CLIENTE ─────────────────────────────────────
      pdf.setFillColor(...BGCARD)
      pdf.setDrawColor(...LGRAY)
      pdf.setLineWidth(0.3)
      pdf.roundedRect(ML, y, CW, 20, 2, 2, 'FD')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(...GRAY)
      pdf.text('CLIENTE', ML + 4, y + 5)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...DARK)
      pdf.text(c.nome, ML + 4, y + 11)

      if (localStr !== '—') {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(...GRAY)
        pdf.text(localStr, ML + 4, y + 16)
      }

      const halfX = ML + CW / 2 + 4
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(...GRAY)
      pdf.text('CONTATO', halfX, y + 5)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...DARK)
      pdf.text(c.telefone || 'Sem telefone', halfX, y + 11)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(...GRAY)
      pdf.text(`Pagamento via: ${FORMA_PAGTO_LABELS[c.forma_pagamento] || c.forma_pagamento}`, halfX, y + 16)

      y += 26

      // ── TABELA DE PEDIDOS ────────────────────────────────
      const colW = [26, CW - 26 - 22 - 28, 22, 28]
      const colX = [ML, ML + colW[0], ML + colW[0] + colW[1], ML + colW[0] + colW[1] + colW[2]]

      pdf.setFillColor(...BLUE)
      pdf.rect(ML, y, CW, 7, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7)
      pdf.setTextColor(255, 255, 255)
      const headers = ['DATA', 'PEÇAS LAVADAS', 'PESO', 'VALOR']
      const aligns: ('left'|'right')[] = ['left', 'left', 'right', 'right']

      headers.forEach((h, i) => {
        if (aligns[i] === 'right') {
          const hw = pdf.getTextWidth(h)
          pdf.text(h, colX[i] + colW[i] - hw - 2, y + 4.8)
        } else {
          pdf.text(h, colX[i] + 2, y + 4.8)
        }
      })
      y += 7

      const pedidosOrdenados = [...pedidosCliente].reverse()
      pedidosOrdenados.forEach((p, idx) => {
        const [ano, mes, dia] = p.data_pedido.split('-')
        const dataFormatada = `${dia}/${mes}/${ano}`
        const valor = receitaPedido(p)
        const itens = itensMap[p.id] || []
        const pecasDetalhadas = itens
          .map((it) => `${it.quantidade}x ${getPecaNome(it.tipo_peca_id)}`)
          .join(', ') || 'Sem especificações'

        const maxPecasWidth = colW[1] - 4
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        const linhasPecas = pdf.splitTextToSize(pecasDetalhadas, maxPecasWidth)
        const rowH = Math.max(7, linhasPecas.length * 4 + 3)

        if (y + rowH > 280) { pdf.addPage(); y = 14 }

        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252)
          pdf.rect(ML, y, CW, rowH, 'F')
        }

        pdf.setDrawColor(...LGRAY)
        pdf.setLineWidth(0.2)
        pdf.line(ML, y + rowH, PW - MR, y + rowH)

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(...DARK)
        pdf.text(dataFormatada, colX[0] + 2, y + 4.8)
        pdf.text(linhasPecas, colX[1] + 2, y + 4.8)

        const pesoText = `${Number(p.peso_kg).toLocaleString('pt-BR')} kg`
        const pesoW = pdf.getTextWidth(pesoText)
        pdf.text(pesoText, colX[2] + colW[2] - pesoW - 2, y + 4.8)

        const valorText = formatBRL(valor)
        pdf.setFont('helvetica', 'bold')
        const valorW = pdf.getTextWidth(valorText)
        pdf.text(valorText, colX[3] + colW[3] - valorW - 2, y + 4.8)

        y += rowH
      })

      y += 6

      // ── TOTAIS ───────────────────────────────────────────
      if (y + 18 > 280) { pdf.addPage(); y = 14 }

      pdf.setFillColor(237, 242, 247)
      pdf.setDrawColor(203, 213, 224)
      pdf.setLineWidth(0.3)
      pdf.roundedRect(ML, y, CW, 16, 2, 2, 'FD')

      const tot1X = ML + CW * 0.33
      const tot2X = ML + CW * 0.66
      const tot3X = ML + CW - 4

      const totItems = [
        { label: 'QUANTIDADE DE ENVIOS', value: String(pedidosCliente.length), cx: ML + CW * 0.165 },
        { label: 'PESO TOTAL', value: `${Number(pesoTotal).toLocaleString('pt-BR')} kg`, cx: (tot1X + tot2X) / 2 },
        { label: 'TOTAL A PAGAR', value: formatBRL(valorTotal), cx: (tot2X + tot3X) / 2 },
      ]

      totItems.forEach((t) => {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(...GRAY)
        centeredText(t.label, t.cx, y + 5)

        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(10)
        pdf.setTextColor(t.label === 'TOTAL A PAGAR' ? BLUE[0] : DARK[0], t.label === 'TOTAL A PAGAR' ? BLUE[1] : DARK[1], t.label === 'TOTAL A PAGAR' ? BLUE[2] : DARK[2])
        centeredText(t.value, t.cx, y + 12)
      })

      pdf.setDrawColor(203, 213, 224)
      pdf.setLineWidth(0.3)
      pdf.line(tot1X, y + 2, tot1X, y + 14)
      pdf.line(tot2X, y + 2, tot2X, y + 14)

      y += 22

      // ── PIX ──────────────────────────────────────────────
      if (y + 22 > 280) { pdf.addPage(); y = 14 }

      pdf.setFillColor(235, 248, 255)
      pdf.setDrawColor(190, 227, 248)
      pdf.setLineWidth(0.3)
      pdf.roundedRect(ML, y, CW, 22, 2, 2, 'FD')

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor(43, 108, 176)
      pdf.text('Dados para Pagamento via PIX', ML + 4, y + 7)

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...DARK)
      pdf.text('Beneficiário: Ramon Pereira Paixão', ML + 4, y + 13)

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...BLUE)
      pdf.text('Chave PIX (CNPJ): 59.815.300/0001-71', ML + 4, y + 19)

      y += 28

      // ── RODAPÉ ───────────────────────────────────────────
      pdf.setDrawColor(...LGRAY)
      pdf.setLineWidth(0.3)
      pdf.line(ML, y, PW - MR, y)
      y += 5

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(7)
      pdf.setTextColor(...GRAY)
      centeredText('Ciclo Novo Lavanderia · Higiene, Carinho e Sustentabilidade para suas Roupas', PW / 2, y)

      // ── COMPARTILHAR ─────────────────────────────────────
      const pdfBlob = pdf.output('blob')
      const file = new File([pdfBlob], `fechamento-${c.nome.replace(/\s+/g, '-')}.pdf`, { type: 'application/pdf' })

      const textoMensagem = `Olá, ${primeiroNome}! Tudo bem?\n\n` +
        `Segue o fechamento da lavanderia em PDF.\n\n` +
        `Qualquer dúvida estou à disposição! 💙`

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'Fechamento Lavanderia',
          text: textoMensagem
        }).then(() => {
          setMsg('Compartilhado com sucesso!')
          setTimeout(() => setMsg(null), 4000)
        }).catch((err) => {
          if (err.name !== 'AbortError') {
            setErro(`Erro ao compartilhar: ${err.message || err}`)
          } else {
            setMsg(null)
          }
        })
      } else {
        setErro('Seu dispositivo não suporta compartilhamento direto de arquivos.')
        setMsg(null)
      }
    } catch (err: any) {
      setErro(`Erro ao processar PDF: ${err.message || err}`)
      setMsg(null)
    }
  }

  // Gera o PDF consolidado com todas as pendências para os clientes SELECIONADOS
  function handleGerarPDFConsolidado() {
    if (selectedClientesIds.size === 0) return

    const selecionados = usouPagouComPendencia.filter((item) =>
      selectedClientesIds.has(item.cliente.id)
    )

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // 1) Linhas da tabela de resumo
    let totalEnviosGeral = 0
    let totalPesoGeral = 0
    let totalValorGeral = 0

    const linhasResumo = selecionados
      .map((item) => {
        totalEnviosGeral += item.pedidos.length
        totalPesoGeral += item.pesoTotal
        totalValorGeral += item.valorTotal

        const localStr = formatarLocal(item.cliente)
        return `
          <tr>
            <td style="font-weight: 600;">${item.cliente.nome}</td>
            <td>${localStr}</td>
            <td>${item.cliente.telefone || '—'}</td>
            <td style="text-align: center;">${item.pedidos.length}</td>
            <td style="text-align: right;">${Number(item.pesoTotal).toLocaleString('pt-BR')} kg</td>
            <td style="text-align: right; font-weight: 700; color: #ef4444;">${formatBRL(item.valorTotal)}</td>
          </tr>
        `
      })
      .join('')

    // 2) Detalhamento individual de cada cliente selecionado (com page break)
    const detalhamentoClientes = selecionados
      .map((item) => {
        const localStr = formatarLocal(item.cliente)
        const linhasPedidos = item.pedidos
          .slice()
          .reverse()
          .map((p) => {
            const [ano, mes, dia] = p.data_pedido.split('-')
            const dataFormatada = `${dia}/${mes}/${ano}`
            const valor = receitaPedido(p)
            
            const itens = itensMap[p.id] || []
            const pecasDetalhadas = itens
              .map((it) => `${it.quantidade}x ${getPecaNome(it.tipo_peca_id)}`)
              .join(', ') || 'Sem especificações'

            return `
              <tr>
                <td>${dataFormatada}</td>
                <td>${pecasDetalhadas}</td>
                <td style="text-align: right;">${Number(p.peso_kg).toLocaleString('pt-BR')} kg</td>
                <td style="text-align: right; font-weight: 600;">${formatBRL(valor)}</td>
              </tr>
            `
          })
          .join('')

        return `
          <div class="cliente-breakdown">
            <div class="cliente-breakdown-header">
              <h3>${item.cliente.nome}</h3>
              <p>${localStr !== '—' ? `📍 ${localStr} &nbsp;·&nbsp; ` : ''} 📞 ${item.cliente.telefone || 'Sem telefone'}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 15%;">Data</th>
                  <th style="width: 50%;">Peças Lavadas</th>
                  <th style="width: 15%; text-align: right;">Peso</th>
                  <th style="width: 20%; text-align: right;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${linhasPedidos}
              </tbody>
            </table>
            <div style="display: flex; justify-content: flex-end; gap: 20px; font-weight: 700; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: -15px; margin-bottom: 25px;">
              <div>Envios: ${item.pedidos.length}</div>
              <div>Peso: ${Number(item.pesoTotal).toLocaleString('pt-BR')} kg</div>
              <div style="color: #3b6fe8;">Total: ${formatBRL(item.valorTotal)}</div>
            </div>
          </div>
        `
      })
      .join('')

    const dataEmissao = new Date().toLocaleDateString('pt-BR')
    const baseUrl = window.location.origin

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Pendências - Clientes</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #333;
            background-color: #ffffff !important;
            margin: 0;
            padding: 20px;
            font-size: 13px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #ef4444;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .logo-container {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .brand-name {
            font-size: 22px;
            font-weight: 800;
            color: #ef4444;
            margin: 0;
          }
          .brand-sub {
            font-size: 11px;
            color: #666;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .doc-title {
            font-size: 18px;
            font-weight: 700;
            text-align: right;
            margin: 0;
            color: #333;
          }
          .doc-date {
            font-size: 12px;
            color: #666;
            text-align: right;
            margin-top: 4px;
          }
          
          h2.section-title {
            font-size: 15px;
            color: #1a202c;
            border-bottom: 1.5px solid #cbd5e0;
            padding-bottom: 6px;
            margin-top: 30px;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th {
            background-color: #4a5568;
            color: white;
            font-weight: 600;
            text-align: left;
            padding: 8px 10px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 12px;
            color: #2d3748;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          
          .totals-bar {
            display: flex;
            justify-content: flex-end;
            gap: 30px;
            background: #edf2f7;
            padding: 10px 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            border: 1px solid #cbd5e0;
          }
          .total-item {
            text-align: right;
          }
          .total-label {
            font-size: 10px;
            color: #4a5568;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .total-value {
            font-size: 16px;
            font-weight: 700;
            color: #1a202c;
          }

          .cliente-breakdown {
            page-break-inside: avoid;
            margin-bottom: 30px;
          }
          .cliente-breakdown-header {
            margin-bottom: 10px;
            padding-left: 4px;
            border-left: 3px solid #3b6fe8;
          }
          .cliente-breakdown-header h3 {
            margin: 0;
            font-size: 14px;
            color: #1a202c;
          }
          .cliente-breakdown-header p {
            margin: 2px 0 0 0;
            font-size: 11px;
            color: #718096;
          }
          
          .payment-instructions {
            background-color: #fef2f2;
            border: 1px solid #fee2e2;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            margin-bottom: 25px;
          }
          .payment-instructions h4 {
            margin: 0 0 8px 0;
            color: #991b1b;
            font-size: 14px;
          }
          .payment-instructions p {
            margin: 0;
            font-size: 13px;
            color: #2d3748;
          }

          .footer-note {
            text-align: center;
            font-size: 10px;
            color: #a0aec0;
            margin-top: 40px;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
          }
          
          @media print {
            @page {
              margin: 0;
            }
            body {
              margin: 1.6cm;
              padding: 0;
            }
            .cliente-breakdown {
              page-break-inside: avoid;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px;">
          <button onclick="window.close(); if(window.history.length > 1) { window.history.back(); } else { window.location.href = '${baseUrl}'; }" style="padding: 10px 16px; font-size: 14px; background-color: #e2e8f0; color: #1a202c; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
            ⬅ Voltar ao Aplicativo
          </button>
        </div>
        <div class="header">
          <div class="logo-container">
            <img src="${baseUrl}/logo.png" alt="Logo" class="logo-img" onerror="this.style.display='none'" style="width:40px;height:40px;object-fit:contain;" />
            <div>
              <h1 class="brand-name">Ciclo Novo</h1>
              <p class="brand-sub">Lavanderia</p>
            </div>
          </div>
          <div>
            <h2 class="doc-title">Relatório Geral de Pendências</h2>
            <p class="doc-date">Emitido em: ${dataEmissao}</p>
          </div>
        </div>

        <h2 class="section-title">Resumo Financeiro por Cliente</h2>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Local / Unidade</th>
              <th>Telefone</th>
              <th style="text-align: center;">Qtd Envios</th>
              <th style="text-align: right;">Peso Acumulado</th>
              <th style="text-align: right;">Saldo devedor</th>
            </tr>
          </thead>
          <tbody>
            ${linhasResumo}
          </tbody>
        </table>

        <div class="totals-bar">
          <div class="total-item">
            <div class="total-label">Clientes Selecionados</div>
            <div class="total-value">${selecionados.length}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Quantidade de Envios</div>
            <div class="total-value">${totalEnviosGeral}</div>
          </div>
          <div class="total-item">
            <div class="total-label">Peso Acumulado</div>
            <div class="total-value">${Number(totalPesoGeral).toLocaleString('pt-BR')} kg</div>
          </div>
          <div class="total-item">
            <div class="total-label">Valor Geral Pendente</div>
            <div class="total-value" style="color: #ef4444;">${formatBRL(totalValorGeral)}</div>
          </div>
        </div>

        <div class="payment-instructions">
          <h4>Dados para Pagamento via PIX</h4>
          <p style="margin: 0; font-weight: 600;">Beneficiário: Ramon Pereira Paixão</p>
          <p style="margin: 4px 0 0 0; font-weight: bold; color: #ef4444; font-size: 15px;">Chave PIX (CNPJ): 59.815.300/0001-71</p>
        </div>

        <h2 class="section-title" style="page-break-before: auto;">Detalhamento das Pendências</h2>
        ${detalhamentoClientes}

        <p class="footer-note">Ciclo Novo Lavanderia · Relatório Gerencial Gerado em ${dataEmissao}</p>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const FORMA_PAGTO_LABELS: Record<string, string> = {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    transferencia: 'Transferência Bancária',
    outro: 'Outro',
  }

  if (loading) {
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
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Carregando faturamento avulso...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <style>{`
        .client-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          flex-wrap: wrap;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .client-card-stats {
          display: flex;
          align-items: center;
          gap: 24px;
          flex-wrap: wrap;
        }

        .client-card-stat-item {
          text-align: right;
        }

        @media (max-width: 768px) {
          .client-card-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .client-card-stats {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            border-top: 1px dashed var(--border);
            padding-top: 10px;
          }

          .client-card-stat-item {
            text-align: left;
          }
        }
      `}</style>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Faturamento Usou e Pagou</h1>
        <div className="hint">
          Fechamento de faturamento e cobrança de clientes no plano Usou e Pagou.
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panelHeader" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, color: 'var(--accent)', margin: 0 }}>Clientes Devedores</h2>
            <span className="badge badgeRed" style={{ fontSize: 12 }}>
              {selectedClientesIds.size} selecionado(s)
            </span>
          </div>
          
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
            <button
              className="btn btnPrimary"
              type="button"
              disabled={selectedClientesIds.size === 0}
              onClick={handleGerarPDFConsolidado}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 14px' }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Gerar PDF de Pendências Selecionadas
            </button>

            <div className="field" style={{ minWidth: 220, margin: 0, flex: '1 1 auto' }}>
              <input
                type="text"
                placeholder="Buscar por nome ou condomínio..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                  width: '100%'
                }}
              />
            </div>
            
            <div className="field" style={{ minWidth: 220, margin: 0, flex: '1 1 auto' }}>
              <input
                type="text"
                placeholder="Chave Pix para cobrança..."
                value={chavePix}
                onChange={(e) => handleChavePixChange(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 13,
                  width: '100%'
                }}
              />
            </div>
          </div>
        </div>

        <div className="panelBody" style={{ padding: '16px 0' }}>
          {usouPagouComPendencia.length === 0 ? (
            <div className="hint" style={{ textAlign: 'center', padding: '30px 20px' }}>
              Nenhum cliente Usou e Pagou com pendências em aberto.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14, padding: '0 16px' }}>
              
              {/* Opção de Selecionar Todos */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <input
                  type="checkbox"
                  id="select-all-checkbox"
                  checked={todosSelecionados}
                  onChange={handleSelectAll}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    margin: 0
                  }}
                />
                <label htmlFor="select-all-checkbox" style={{ margin: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  Selecionar todos os clientes filtrados ({usouPagouComPendencia.length})
                </label>
              </div>

              {usouPagouComPendencia.map((item) => {
                const isExpanded = expandedClienteId === item.cliente.id
                const isSelected = selectedClientesIds.has(item.cliente.id)
                return (
                  <div
                    key={item.cliente.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      background: 'var(--bg)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease-in-out',
                      boxShadow: isExpanded ? 'var(--shadow-raised)' : 'none',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)'
                    }}
                  >
                    {/* Header do Card */}
                    <div
                      style={{
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14
                      }}
                    >
                      {/* Checkbox de seleção */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.cliente.id)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          margin: 0,
                          flexShrink: 0
                        }}
                      />

                      <div
                        onClick={() => setExpandedClienteId(isExpanded ? null : item.cliente.id)}
                        className="client-card-header"
                      >
                        <div style={{ flex: '1 1 auto' }}>
                          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>
                            {item.cliente.nome}
                          </h3>
                          <span className="hint" style={{ fontSize: 12, marginTop: 2, display: 'block' }}>
                            📍 {formatarLocal(item.cliente)}
                          </span>
                        </div>
                        
                        <div className="client-card-stats">
                          <div className="client-card-stat-item">
                            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>PEDIDOS</span>
                            <strong style={{ fontSize: 13, color: 'var(--text-h)' }}>{item.pedidos.length} envios</strong>
                          </div>
                          <div className="client-card-stat-item">
                            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>PESO TOTAL</span>
                            <strong style={{ fontSize: 13, color: 'var(--text-h)' }}>{item.pesoTotal.toLocaleString('pt-BR')} kg</strong>
                          </div>
                          <div className="client-card-stat-item">
                            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>SALDO EM ABERTO</span>
                            <strong style={{ fontSize: 14, color: 'var(--danger)' }}>{formatBRL(item.valorTotal)}</strong>
                          </div>
                          
                          <div style={{
                            display: 'flex',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s',
                            color: 'var(--muted)'
                          }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Detalhamento Expandido */}
                    {isExpanded && (
                      <div style={{
                        borderTop: '1px solid var(--border)',
                        padding: '16px 18px',
                        background: 'var(--panel)',
                        display: 'grid',
                        gap: 16
                      }}>
                        {/* Ações Rápidas */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                          <button
                            className="btn btnSuccess"
                            type="button"
                            onClick={() => handleCobrarWhatsApp(item.cliente, item.pedidos, item.pesoTotal, item.valorTotal)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 14px' }}
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13" />
                              <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                            Cobrar no WhatsApp
                          </button>
                          
                          <button
                            className="btn btnPrimary"
                            type="button"
                            onClick={() => handleGerarPDF(item.cliente, item.pedidos, item.pesoTotal, item.valorTotal, false)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 14px' }}
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                              <polyline points="10 9 9 9 8 9" />
                            </svg>
                            Gerar Relatório (PDF)
                          </button>

                          <button
                            className="btn"
                            type="button"
                            onClick={() => handleCopiarPNG(item.cliente, item.pedidos, item.pesoTotal, item.valorTotal)}
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 8, 
                              fontSize: 13, 
                              padding: '8px 14px',
                              background: 'var(--panel)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-h)',
                              cursor: 'pointer'
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copiar PNG
                          </button>

                          <button
                            className="btn"
                            type="button"
                            onClick={() => handleGerarPDF(item.cliente, item.pedidos, item.pesoTotal, item.valorTotal, true)}
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 8, 
                              fontSize: 13, 
                              padding: '8px 14px',
                              background: 'var(--panel)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-h)',
                              cursor: 'pointer'
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                            Baixar PNG
                          </button>

                          {typeof navigator.share !== 'undefined' && (
                            <button
                              className="btn btnSuccess"
                              type="button"
                              onClick={() => handleCompartilharPDF(item.cliente, item.pedidos, item.pesoTotal, item.valorTotal)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '8px 14px' }}
                            >
                              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                              Compartilhar
                            </button>
                          )}

                          <button
                            className="btn"
                            type="button"
                            onClick={() => handleCopiarMensagemPronta(item.cliente)}
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 8, 
                              fontSize: 13, 
                              padding: '8px 14px',
                              background: 'var(--panel)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-h)',
                              cursor: 'pointer'
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            MENSAGEM PRONTA
                          </button>
                        </div>

                        {/* Tabela de Pedidos do Cliente */}
                        <div className="tableWrap" style={{ background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <table style={{ margin: 0 }}>
                            <thead>
                              <tr>
                                <th>Data</th>
                                <th>Peças Lavadas</th>
                                <th style={{ textAlign: 'right' }}>Peso</th>
                                <th style={{ textAlign: 'right' }}>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.pedidos
                                .slice()
                                .reverse()
                                .map((p) => {
                                  const itens = itensMap[p.id] || []
                                  return (
                                    <tr key={p.id}>
                                      <td>
                                        {new Date(`${p.data_pedido}T00:00:00`).toLocaleDateString('pt-BR')}
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                          {itens.length === 0 ? (
                                            <span className="hint" style={{ fontSize: 11 }}>Sem itens</span>
                                          ) : (
                                            itens.map((it) => (
                                              <span
                                                key={it.id}
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: 600,
                                                  background: 'var(--accent-bg)',
                                                  border: '1px solid var(--accent-border)',
                                                  color: 'var(--accent)',
                                                  padding: '2px 6px',
                                                  borderRadius: 6
                                                }}
                                              >
                                                {it.quantidade}x {getPecaNome(it.tipo_peca_id)}
                                              </span>
                                            ))
                                          )}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        {Number(p.peso_kg).toLocaleString('pt-BR')} kg
                                      </td>
                                      <td style={{ textAlign: 'right', fontWeight: 650, color: 'var(--text-h)' }}>
                                        {formatBRL(receitaPedido(p))}
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
