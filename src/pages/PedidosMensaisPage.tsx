import { useEffect, useMemo, useState } from 'react'
import { fetchClientes } from '../data/clientes'
import { fetchPedidos, fetchItensPorPedidos } from '../data/pedidos'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { Cliente, PedidoCliente, ItemPedido, TipoPeca } from '../types/models'
import { receitaPedido } from '../domain/finance'
import { formatBRL, normalizeSearch } from '../lib/format'
import { StatusBanner } from '../components/StatusBanner'
import html2canvas from 'html2canvas'
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

export function PedidosMensaisPage() {
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

      // Filtra clientes mensalistas
      const mensalistas = cliRes.data.filter((c) => c.plano === 'mensal')
      setClientes(mensalistas)

      // Filtra pedidos não pagos dos mensalistas
      const mensalistasIds = new Set(mensalistas.map((c) => c.id))
      const pedidosMensalistas = pedRes.data.filter(
        (p) => mensalistasIds.has(p.cliente_id) && p.pagamento_status !== 'pago' && p.status !== 'cancelado'
      )
      setPedidos(pedidosMensalistas)
      setTiposPeca(tipoRes.data)

      // Carrega os itens dos pedidos encontrados
      if (pedidosMensalistas.length > 0) {
        const orderIds = pedidosMensalistas.map((p) => p.id)
        const itensRes = await fetchItensPorPedidos(orderIds)
        if (itensRes.error) {
          setErro(itensRes.error)
        } else {
          const grouped: Record<string, ItemPedido[]> = {}
          pedidosMensalistas.forEach((p) => {
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
  const mensalistasComPendencia = useMemo(() => {
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
      `Segue o detalhamento das lavagens do seu plano mensal:\n\n` +
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

  // Gera o PDF ou PNG de fechamento formatado na tela de impressão
  function handleGerarPDF(c: Cliente, pedidosCliente: PedidoCliente[], pesoTotal: number, valorTotal: number, isPng = false) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // Organiza a descrição dos itens de cada pedido
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
        <title>Fechamento Mensal - ${c.nome}</title>
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
            <img src="${baseUrl}/logo.png" alt="Logo" class="logo-img" onerror="this.style.display='none'" />
            <div>
              <h1 class="brand-name">Ciclo Novo</h1>
              <p class="brand-sub">Lavanderia</p>
            </div>
          </div>
          <div>
            <h2 class="doc-title">Fechamento de Mensalista</h2>
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
            <span>Plano Mensal · Pagamento acordado via: ${FORMA_PAGTO_LABELS[c.forma_pagamento] || c.forma_pagamento}</span>
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
            <div class="total-label">Peso Total Acumulado</div>
            <div class="total-value">${Number(pesoTotal).toLocaleString('pt-BR')} kg</div>
          </div>
          <div class="total-item">
            <div class="total-label">Total Geral a Pagar</div>
            <div class="total-value" style="color: #3b6fe8;">${formatBRL(valorTotal)}</div>
          </div>
        </div>

        <div class="payment-instructions">
          <h4>Dados para Pagamento via PIX</h4>
          <p style="margin: 0; font-weight: 600;">Beneficiário: Ramon Pereira Paixão</p>
          <p style="margin: 4px 0 0 0; font-weight: bold; color: #3b6fe8; font-size: 15px;">Chave PIX: ${chavePix || '59.815.300/0001-71 (CNPJ)'}</p>
        </div>

        <p class="footer-note">Ciclo Novo Lavanderia · Higiene, Carinho e Sustentabilidade para suas Roupas</p>

        <script>
          window.onload = function() {
            setTimeout(function() {
              ${isPng 
                ? `
                html2canvas(document.body).then(function(canvas) {
                  var link = document.createElement('a');
                  link.download = 'fatura-${c.nome.replace(/\s+/g, '-')}.png';
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

  // Copia a imagem PNG do fechamento diretamente para a área de transferência
  async function handleCopiarPNG(c: Cliente, pedidosCliente: PedidoCliente[], pesoTotal: number, valorTotal: number) {
    try {
      setMsg('Gerando imagem para cópia...')
      const logoBase64 = await getBase64Image('/logo.png')

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
              <td style="width: 18%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; white-space: nowrap;">${dataFormatada}</td>
              <td style="width: 52%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; word-break: break-word; overflow-wrap: break-word;">${pecasDetalhadas}</td>
              <td style="width: 15%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; text-align: right; white-space: nowrap;">${Number(p.peso_kg).toLocaleString('pt-BR')} kg</td>
              <td style="width: 15%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; text-align: right; font-weight: 600; white-space: nowrap;">${formatBRL(valor)}</td>
            </tr>
          `
        })
        .join('')

      const localStr = formatarLocal(c)
      const dataEmissao = new Date().toLocaleDateString('pt-BR')

      const tempDiv = document.createElement('div')
      tempDiv.style.position = 'fixed'
      tempDiv.style.left = '0'
      tempDiv.style.top = '0'
      tempDiv.style.width = '650px'
      tempDiv.style.minWidth = '650px'
      tempDiv.style.maxWidth = '650px'
      tempDiv.style.overflow = 'visible'
      tempDiv.style.opacity = '0'
      tempDiv.style.pointerEvents = 'none'
      tempDiv.style.zIndex = '-9999'
      tempDiv.style.backgroundColor = '#ffffff'

      tempDiv.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; padding: 25px; background: #ffffff;">
          <table style="width: 100%; border-bottom: 2px solid #3b6fe8; padding-bottom: 15px; margin-bottom: 25px; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <table style="border-collapse: collapse; border: none;">
                  <tr>
                    <td style="padding: 0 12px 0 0; border: none; vertical-align: middle;">
                      <img src="${logoBase64}" alt="Logo" style="width: 50px; height: 50px; object-fit: contain; display: block;" />
                    </td>
                    <td style="padding: 0; border: none; vertical-align: middle;">
                      <h1 style="font-size: 22px; font-weight: 800; color: #3b6fe8; margin: 0; line-height: 1.1;">Ciclo Novo</h1>
                      <p style="font-size: 11px; color: #666; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Lavanderia</p>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <h2 style="font-size: 18px; font-weight: 700; margin: 0; color: #333;">Fechamento de Mensalista</h2>
                <p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">Emitido em: ${dataEmissao}</p>
              </td>
            </tr>
          </table>

          <table style="width: 100%; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                <h3 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px;">Cliente</h3>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a202c;">${c.nome}</p>
                ${localStr !== '—' ? `<span style="display: block; font-size: 13px; color: #4a5568; margin-top: 2px; font-weight: 400;">${localStr}</span>` : ''}
              </td>
              <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                <h3 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px;">Contato</h3>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a202c;">${c.telefone || 'Sem telefone'}</p>
                <span style="display: block; font-size: 13px; color: #4a5568; margin-top: 2px; font-weight: 400;">Plano Mensal · Pagamento via: ${FORMA_PAGTO_LABELS[c.forma_pagamento] || c.forma_pagamento}</span>
              </td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; table-layout: fixed;">
            <thead>
              <tr style="background-color: #3b6fe8; color: white;">
                <th style="width: 18%; font-weight: 600; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Data</th>
                <th style="width: 52%; font-weight: 600; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Peças Lavadas</th>
                <th style="width: 15%; font-weight: 600; text-align: right; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Peso</th>
                <th style="width: 15%; font-weight: 600; text-align: right; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${detalhesPedidos}
            </tbody>
          </table>

          <table style="width: 100%; background: #edf2f7; padding: 12px 20px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #cbd5e0; border-collapse: collapse;">
            <tr>
              <td style="text-align: right; padding-right: 30px; border: none;">
                <div style="font-size: 11px; color: #4a5568; text-transform: uppercase; margin-bottom: 2px;">Quantidade de Envios</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a202c;">${pedidosCliente.length}</div>
              </td>
              <td style="text-align: right; padding-right: 30px; border: none;">
                <div style="font-size: 11px; color: #4a5568; text-transform: uppercase; margin-bottom: 2px;">Peso Total Acumulado</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a202c;">${Number(pesoTotal).toLocaleString('pt-BR')} kg</div>
              </td>
              <td style="text-align: right; border: none;">
                <div style="font-size: 11px; color: #4a5568; text-transform: uppercase; margin-bottom: 2px;">Total Geral a Pagar</div>
                <div style="font-size: 18px; font-weight: 700; color: #3b6fe8;">${formatBRL(valorTotal)}</div>
              </td>
            </tr>
          </table>

          <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 15px; margin-top: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #2b6cb0; font-size: 14px;">Dados para Pagamento via PIX</h4>
            <p style="margin: 0; font-weight: 600; color: #2d3748;">Beneficiário: Ramon Pereira Paixão</p>
            <p style="margin: 4px 0 0 0; font-weight: bold; color: #3b6fe8; font-size: 15px;">Chave PIX: ${chavePix || '59.815.300/0001-71 (CNPJ)'}</p>
          </div>

          <p style="text-align: center; font-size: 11px; color: #a0aec0; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px;">Ciclo Novo Lavanderia · Higiene, Carinho e Sustentabilidade para suas Roupas</p>
        </div>
      `

      document.body.appendChild(tempDiv)

      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        width: 650,
        windowWidth: 650
      })

      document.body.removeChild(tempDiv)

      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Falha ao gerar imagem blob.')
        navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
          setMsg('Imagem do fechamento copiada com sucesso!')
          setTimeout(() => setMsg(null), 4000)
        }).catch((err) => {
          setErro(`Erro ao copiar imagem: ${err.message || err}`)
        })
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
              <td style="width: 18%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; white-space: nowrap;">${dataFormatada}</td>
              <td style="width: 52%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; word-break: break-word; overflow-wrap: break-word;">${pecasDetalhadas}</td>
              <td style="width: 15%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; text-align: right; white-space: nowrap;">${Number(p.peso_kg).toLocaleString('pt-BR')} kg</td>
              <td style="width: 15%; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #2d3748; text-align: right; font-weight: 600; white-space: nowrap;">${formatBRL(valor)}</td>
            </tr>
          `
        })
        .join('')

      const localStr = formatarLocal(c)
      const dataEmissao = new Date().toLocaleDateString('pt-BR')

      const tempDiv = document.createElement('div')
      tempDiv.style.position = 'fixed'
      tempDiv.style.left = '0'
      tempDiv.style.top = '0'
      tempDiv.style.width = '650px'
      tempDiv.style.minWidth = '650px'
      tempDiv.style.maxWidth = '650px'
      tempDiv.style.overflow = 'visible'
      tempDiv.style.opacity = '0'
      tempDiv.style.pointerEvents = 'none'
      tempDiv.style.zIndex = '-9999'
      tempDiv.style.backgroundColor = '#ffffff'

      tempDiv.innerHTML = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333; padding: 25px; background: #ffffff;">
          <table style="width: 100%; border-bottom: 2px solid #3b6fe8; padding-bottom: 15px; margin-bottom: 25px; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <table style="border-collapse: collapse; border: none;">
                  <tr>
                    <td style="padding: 0 12px 0 0; border: none; vertical-align: middle;">
                      <img src="${logoBase64}" alt="Logo" style="width: 50px; height: 50px; object-fit: contain; display: block;" />
                    </td>
                    <td style="padding: 0; border: none; vertical-align: middle;">
                      <h1 style="font-size: 22px; font-weight: 800; color: #3b6fe8; margin: 0; line-height: 1.1;">Ciclo Novo</h1>
                      <p style="font-size: 11px; color: #666; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Lavanderia</p>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <h2 style="font-size: 18px; font-weight: 700; margin: 0; color: #333;">Fechamento de Mensalista</h2>
                <p style="font-size: 12px; color: #666; margin: 4px 0 0 0;">Emitido em: ${dataEmissao}</p>
              </td>
            </tr>
          </table>

          <table style="width: 100%; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                <h3 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px;">Cliente</h3>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a202c;">${c.nome}</p>
                ${localStr !== '—' ? `<span style="display: block; font-size: 13px; color: #4a5568; margin-top: 2px; font-weight: 400;">${localStr}</span>` : ''}
              </td>
              <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                <h3 style="margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #666; letter-spacing: 0.5px;">Contato</h3>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1a202c;">${c.telefone || 'Sem telefone'}</p>
                <span style="display: block; font-size: 13px; color: #4a5568; margin-top: 2px; font-weight: 400;">Plano Mensal · Pagamento via: ${FORMA_PAGTO_LABELS[c.forma_pagamento] || c.forma_pagamento}</span>
              </td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; table-layout: fixed;">
            <thead>
              <tr style="background-color: #3b6fe8; color: white;">
                <th style="width: 18%; font-weight: 600; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Data</th>
                <th style="width: 52%; font-weight: 600; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Peças Lavadas</th>
                <th style="width: 15%; font-weight: 600; text-align: right; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Peso</th>
                <th style="width: 15%; font-weight: 600; text-align: right; padding: 10px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border: none;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${detalhesPedidos}
            </tbody>
          </table>

          <table style="width: 100%; background: #edf2f7; padding: 12px 20px; border-radius: 8px; margin-bottom: 40px; border: 1px solid #cbd5e0; border-collapse: collapse;">
            <tr>
              <td style="text-align: right; padding-right: 30px; border: none;">
                <div style="font-size: 11px; color: #4a5568; text-transform: uppercase; margin-bottom: 2px;">Quantidade de Envios</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a202c;">${pedidosCliente.length}</div>
              </td>
              <td style="text-align: right; padding-right: 30px; border: none;">
                <div style="font-size: 11px; color: #4a5568; text-transform: uppercase; margin-bottom: 2px;">Peso Total Acumulado</div>
                <div style="font-size: 18px; font-weight: 700; color: #1a202c;">${Number(pesoTotal).toLocaleString('pt-BR')} kg</div>
              </td>
              <td style="text-align: right; border: none;">
                <div style="font-size: 11px; color: #4a5568; text-transform: uppercase; margin-bottom: 2px;">Total Geral a Pagar</div>
                <div style="font-size: 18px; font-weight: 700; color: #3b6fe8;">${formatBRL(valorTotal)}</div>
              </td>
            </tr>
          </table>

          <div style="background-color: #ebf8ff; border: 1px solid #bee3f8; border-radius: 8px; padding: 15px; margin-top: 20px;">
            <h4 style="margin: 0 0 8px 0; color: #2b6cb0; font-size: 14px;">Dados para Pagamento via PIX</h4>
            <p style="margin: 0; font-weight: 600; color: #2d3748;">Beneficiário: Ramon Pereira Paixão</p>
            <p style="margin: 4px 0 0 0; font-weight: bold; color: #3b6fe8; font-size: 15px;">Chave PIX: ${chavePix || '59.815.300/0001-71 (CNPJ)'}</p>
          </div>

          <p style="text-align: center; font-size: 11px; color: #a0aec0; margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px;">Ciclo Novo Lavanderia · Higiene, Carinho e Sustentabilidade para suas Roupas</p>
        </div>
      `

      document.body.appendChild(tempDiv)

      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        width: 650,
        windowWidth: 650
      })

      document.body.removeChild(tempDiv)

      const imgData = canvas.toDataURL('image/png')
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = 210
      const pageHeight = 297
      const marginX = 10
      const marginY = 10
      const contentWidth = pageWidth - (marginX * 2) // 190mm
      const contentHeight = pageHeight - (marginY * 2) // 277mm

      const imgWidth = contentWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = marginY

      const coverMargins = (doc: jsPDF) => {
        doc.setFillColor(255, 255, 255)
        doc.rect(0, 0, pageWidth, marginY, 'F')
        doc.rect(0, pageHeight - marginY, pageWidth, marginY, 'F')
      }

      // Adiciona a primeira página
      pdf.addImage(imgData, 'PNG', marginX, position, imgWidth, imgHeight)
      coverMargins(pdf)
      heightLeft -= contentHeight

      // Adiciona páginas extras se necessário
      while (heightLeft > 0) {
        position = marginY - (imgHeight - heightLeft)
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', marginX, position, imgWidth, imgHeight)
        coverMargins(pdf)
        heightLeft -= contentHeight
      }

      const pdfBlob = pdf.output('blob')
      const file = new File([pdfBlob], `fechamento-${c.nome.replace(/\s+/g, '-')}.pdf`, { type: 'application/pdf' })

      const primeiroNome = c.nome.trim().split(' ')[0]
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
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Carregando faturamento mensal...</span>
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
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Faturamento Mensal</h1>
        <div className="hint">
          Fechamento de faturamento e cobrança de clientes no Plano Mensal.
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panelHeader" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, color: 'var(--accent)', margin: 0 }}>Clientes Mensalistas</h2>
          
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
            <div className="field" style={{ minWidth: 240, margin: 0, flex: '1 1 auto' }}>
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
            
            <div className="field" style={{ minWidth: 240, margin: 0, flex: '1 1 auto' }}>
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
          {mensalistasComPendencia.length === 0 ? (
            <div className="hint" style={{ textAlign: 'center', padding: '30px 20px' }}>
              Nenhum cliente mensalista com pendências em aberto.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14, padding: '0 16px' }}>
              {mensalistasComPendencia.map((item) => {
                const isExpanded = expandedClienteId === item.cliente.id
                return (
                  <div
                    key={item.cliente.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      background: 'var(--bg)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease-in-out',
                      boxShadow: isExpanded ? 'var(--shadow-raised)' : 'none'
                    }}
                  >
                    {/* Header do Card */}
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
                            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>PESO ACUMULADO</span>
                            <strong style={{ fontSize: 13, color: 'var(--text-h)' }}>{item.pesoTotal.toLocaleString('pt-BR')} kg</strong>
                          </div>
                          <div className="client-card-stat-item">
                            <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>SALDO EM ABERTO</span>
                            <strong style={{ fontSize: 14, color: 'var(--accent)' }}>{formatBRL(item.valorTotal)}</strong>
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
