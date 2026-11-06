import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosExpedicao, updatePedido } from '../data/pedidos'
import { supabase } from '../lib/supabase'
import { compressImage } from '../utils/image'
import { StatusBanner } from '../components/StatusBanner'
import type { PedidoCliente } from '../types/models'

function telefoneWhatsapp(valor?: string | null) {
  const numeros = (valor ?? '').replace(/\D/g, '')
  if (!numeros) return ''
  return numeros.startsWith('55') ? numeros : `55${numeros}`
}

function localCliente(pedido: PedidoCliente) {
  const cliente = pedido.cliente
  return [
    cliente?.condominio,
    cliente?.bloco ? `Bloco ${cliente.bloco}` : null,
    cliente?.apartamento ? `Apto ${cliente.apartamento}` : null,
  ].filter(Boolean).join(' · ')
}

function mensagemEntrega(pedido: PedidoCliente) {
  const cliente = pedido.cliente
  const local = localCliente(pedido)
  return `Olá, ${cliente?.nome ?? 'cliente'}! Seu pedido da Ciclo Novo está pronto para entrega.${local ? `\n📍 ${local}` : ''}\n📦 Peso: ${Number(pedido.peso_kg).toLocaleString('pt-BR')} kg\n\nSegue a foto da expedição. Por favor, confirme o recebimento. Obrigado!`
}

function linkFoto(valor?: string | null) {
  if (!valor) return null
  return valor.startsWith('http') ? valor : `https://drive.google.com/file/d/${valor}/view?usp=drivesdk`
}

export function ExpedicaoPage() {
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [fotos, setFotos] = useState<Record<string, File | undefined>>({})
  const [processando, setProcessando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    setErro(null)
    const { data, error } = await fetchPedidosExpedicao()
    if (error) setErro(error)
    else setPedidos(data)
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregar() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const grupos = useMemo(() => {
    const mapa = new Map<string, PedidoCliente[]>()
    pedidos.forEach((pedido) => {
      const condominio = pedido.cliente?.condominio?.trim() || 'Sem condomínio cadastrado'
      mapa.set(condominio, [...(mapa.get(condominio) ?? []), pedido])
    })
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  }, [pedidos])

  async function salvarFoto(pedido: PedidoCliente) {
    const original = fotos[pedido.id]
    if (!original) throw new Error('Selecione a foto da entrega antes de compartilhar.')
    const blob = await compressImage(original)
    const arquivo = new File([blob], `entrega-${pedido.id}.jpg`, { type: 'image/jpeg' })
    const form = new FormData()
    form.append('clientName', `Entrega - ${pedido.cliente?.nome ?? 'Cliente'}`)
    form.append('date', new Date().toISOString().slice(0, 10))
    form.append('apartamento', [pedido.cliente?.bloco, pedido.cliente?.apartamento].filter(Boolean).join('-'))
    form.append('peso', String(pedido.peso_kg))
    form.append('file', arquivo, arquivo.name)
    const { data, error } = await supabase.functions.invoke('upload-to-drive', { body: form })
    if (error) throw new Error(error.message)
    const id = data?.publicUrl ?? data?.fileId
    if (!id) throw new Error('O upload não retornou a identificação da foto.')
    const { error: erroPedido } = await updatePedido(pedido.id, { foto_entrega_drive_id: id })
    if (erroPedido) throw new Error(erroPedido)
    setPedidos((atuais) => atuais.map((item) => item.id === pedido.id ? { ...item, foto_entrega_drive_id: id } : item))
    return arquivo
  }

  async function compartilhar(pedido: PedidoCliente) {
    setProcessando(pedido.id)
    setErro(null)
    setMsg(null)
    try {
      const arquivo = await salvarFoto(pedido)
      const texto = mensagemEntrega(pedido)
      const dados = { title: 'Entrega Ciclo Novo', text: texto, files: [arquivo] }
      if (navigator.share && (!navigator.canShare || navigator.canShare(dados))) {
        await navigator.share(dados)
        await updatePedido(pedido.id, { entrega_mensagem_enviada_em: new Date().toISOString() })
        setMsg(`Foto e mensagem de ${pedido.cliente?.nome ?? 'cliente'} prontas no compartilhamento.`)
      } else {
        await navigator.clipboard?.writeText(texto)
        const telefone = telefoneWhatsapp(pedido.cliente?.telefone)
        window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
        setMsg('Foto salva e mensagem aberta no WhatsApp. Anexe a foto selecionada antes de enviar.')
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setMsg('Compartilhamento cancelado; a foto permaneceu salva.')
      else setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setProcessando(null)
    }
  }

  async function marcarEntregue(pedido: PedidoCliente) {
    if (!pedido.foto_entrega_drive_id) {
      setErro('Salve e compartilhe a foto antes de marcar como entregue.')
      return
    }
    setProcessando(pedido.id)
    const { error } = await updatePedido(pedido.id, { status: 'entregue', entregue_em: new Date().toISOString() })
    setProcessando(null)
    if (error) setErro(error)
    else {
      setPedidos((atuais) => atuais.filter((item) => item.id !== pedido.id))
      setMsg(`Entrega de ${pedido.cliente?.nome ?? 'cliente'} concluída.`)
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <header className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22 }}>Expedição</h1>
          <div className="hint">Pedidos prontos, separados por condomínio. Fotografe, compartilhe no WhatsApp e confirme a entrega.</div>
        </div>
        <button className="btn" type="button" onClick={() => void carregar()}>Atualizar</button>
      </header>
      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}
      {loading ? <section className="panel"><div className="panelBody hint">Carregando expedição…</div></section> : null}
      {!loading && grupos.length === 0 ? <section className="panel"><div className="panelBody hint">Nenhum pedido aguardando expedição.</div></section> : null}
      {grupos.map(([condominio, itens]) => (
        <section className="panel" key={condominio}>
          <div className="panelHeader">
            <div><h2 style={{ fontSize: 18 }}>🏢 {condominio}</h2><div className="hint">{itens.length} entrega(s)</div></div>
          </div>
          <div className="panelBody grid" style={{ gap: 12 }}>
            {itens.map((pedido) => {
              const fotoUrl = linkFoto(pedido.foto_entrega_drive_id)
              const telefone = telefoneWhatsapp(pedido.cliente?.telefone)
              return (
                <article key={pedido.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ color: 'var(--text-h)', fontSize: 16 }}>{pedido.cliente?.nome ?? 'Cliente não encontrado'}</strong>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{localCliente(pedido) || 'Bloco e apartamento não cadastrados'}</div>
                      <div className="hint">{Number(pedido.peso_kg).toLocaleString('pt-BR')} kg · pedido de {new Date(`${pedido.data_pedido}T12:00:00`).toLocaleDateString('pt-BR')}</div>
                    </div>
                    {!telefone ? <span className="badge badgeYellow">Sem telefone</span> : null}
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label htmlFor={`foto-${pedido.id}`}>Foto da entrega</label>
                    <input id={`foto-${pedido.id}`} type="file" accept="image/*" capture="environment" onChange={(e) => setFotos((atuais) => ({ ...atuais, [pedido.id]: e.target.files?.[0] }))} />
                    {fotos[pedido.id] ? <span className="hint">Selecionada: {fotos[pedido.id]?.name}</span> : null}
                  </div>
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn btnSuccess" type="button" disabled={!fotos[pedido.id] || processando === pedido.id} onClick={() => void compartilhar(pedido)}>
                      {processando === pedido.id ? 'Preparando…' : 'Compartilhar foto + mensagem'}
                    </button>
                    {fotoUrl ? <a className="btn" href={fotoUrl} target="_blank" rel="noreferrer">Ver foto salva</a> : null}
                    <button className="btn btnPrimary" type="button" disabled={!pedido.foto_entrega_drive_id || processando === pedido.id} onClick={() => void marcarEntregue(pedido)}>Marcar como entregue</button>
                  </div>
                  {!telefone ? <div className="hint" style={{ marginTop: 8 }}>Cadastre o telefone do cliente para abrir o WhatsApp diretamente.</div> : null}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
