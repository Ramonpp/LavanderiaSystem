import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosExpedicao } from '../data/pedidos'
import { supabase } from '../lib/supabase'
import { compressImage } from '../utils/image'
import { StatusBanner } from '../components/StatusBanner'
import type { PedidoCliente } from '../types/models'

function dataLocalHoje() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function dataBR(valor: string) {
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function localCliente(pedido: PedidoCliente) {
  return [
    pedido.cliente?.bloco ? `Bloco ${pedido.cliente.bloco}` : null,
    pedido.cliente?.apartamento ? `Apto ${pedido.cliente.apartamento}` : null,
  ].filter(Boolean).join(' · ')
}

function mensagemLote(pedidos: PedidoCliente[]) {
  const grupos = new Map<string, PedidoCliente[]>()
  pedidos.forEach((pedido) => {
    const condominio = pedido.cliente?.condominio?.trim() || 'Sem condomínio cadastrado'
    grupos.set(condominio, [...(grupos.get(condominio) ?? []), pedido])
  })
  const lista = [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([condominio, itens]) => {
    const clientes = itens.map((pedido) => [
      pedido.cliente?.nome ?? 'Cliente',
      pedido.cliente?.apartamento,
      pedido.cliente?.bloco,
    ].filter(Boolean).join(' ')).join('\n')
    return `🏢 *${condominio}*\n${clientes}`
  }).join('\n\n')
  return `🚚 *Entrega ${dataBR(dataLocalHoje())}*\n\n${lista}\n\nRecolhido - ${pedidos.length}`
}

export function ExpedicaoPage() {
  const [pedidos, setPedidos] = useState<PedidoCliente[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [dataSelecionada, setDataSelecionada] = useState(dataLocalHoje)
  const [foto, setFoto] = useState<File | null>(null)
  const [processando, setProcessando] = useState(false)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function selecionarPedidosDaData(data: string, lista = pedidos) {
    setDataSelecionada(data)
    setSelecionados(new Set(lista.filter((pedido) => pedido.data_pedido === data).map((pedido) => pedido.id)))
  }

  async function carregar() {
    setLoading(true)
    setErro(null)
    const { data, error } = await fetchPedidosExpedicao()
    if (error) setErro(error)
    else {
      setPedidos(data)
      selecionarPedidosDaData(dataSelecionada, data)
    }
    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregar() }, 0)
    return () => window.clearTimeout(timer)
    // carregar faz apenas a carga inicial desta fila.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pedidosSelecionados = useMemo(() => pedidos.filter((pedido) => selecionados.has(pedido.id)), [pedidos, selecionados])
  const grupos = useMemo(() => {
    const mapa = new Map<string, PedidoCliente[]>()
    pedidos.forEach((pedido) => {
      const condominio = pedido.cliente?.condominio?.trim() || 'Sem condomínio cadastrado'
      mapa.set(condominio, [...(mapa.get(condominio) ?? []), pedido])
    })
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  }, [pedidos])

  function alternarPedido(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  async function salvarFotoGeral() {
    if (!foto) throw new Error('Selecione a foto geral da expedição.')
    if (!pedidosSelecionados.length) throw new Error('Selecione ao menos um pedido para expedir.')
    const blob = await compressImage(foto)
    const arquivo = new File([blob], `expedicao-${dataSelecionada}.jpg`, { type: 'image/jpeg' })
    const pesoTotal = pedidosSelecionados.reduce((soma, pedido) => soma + Number(pedido.peso_kg), 0)
    const form = new FormData()
    form.append('clientName', 'Expedição geral')
    form.append('date', dataSelecionada)
    form.append('apartamento', `${pedidosSelecionados.length} entregas`)
    form.append('peso', String(pesoTotal))
    form.append('file', arquivo, arquivo.name)
    const { data, error } = await supabase.functions.invoke('upload-to-drive', { body: form })
    if (error) throw new Error(error.message)
    const idFoto = data?.publicUrl ?? data?.fileId
    if (!idFoto) throw new Error('O upload não retornou a identificação da foto.')
    const { error: erroAtualizacao } = await supabase.from('pedido').update({ foto_entrega_drive_id: idFoto }).in('id', pedidosSelecionados.map((pedido) => pedido.id))
    if (erroAtualizacao) throw new Error(erroAtualizacao.message)
    setPedidos((atuais) => atuais.map((pedido) => selecionados.has(pedido.id) ? { ...pedido, foto_entrega_drive_id: idFoto } : pedido))
    return arquivo
  }

  async function compartilharLote() {
    setProcessando(true)
    setErro(null)
    setMsg(null)
    try {
      const arquivo = await salvarFotoGeral()
      const texto = mensagemLote(pedidosSelecionados)
      const dados = { title: 'Expedição Ciclo Novo', text: texto, files: [arquivo] }
      if (navigator.share && (!navigator.canShare || navigator.canShare(dados))) {
        await navigator.share(dados)
        await supabase.from('pedido').update({ entrega_mensagem_enviada_em: new Date().toISOString() }).in('id', pedidosSelecionados.map((pedido) => pedido.id))
        setMsg('Foto geral e mensagem do lote prontas no compartilhamento. Escolha o WhatsApp para enviar.')
      } else {
        await navigator.clipboard?.writeText(texto)
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
        setMsg('Foto salva e mensagem aberta no WhatsApp. Anexe a foto geral selecionada antes de enviar.')
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setMsg('Compartilhamento cancelado; a foto geral permaneceu salva.')
      else setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setProcessando(false)
    }
  }

  async function marcarLoteEntregue() {
    if (!pedidosSelecionados.length) return setErro('Selecione ao menos um pedido.')
    if (pedidosSelecionados.some((pedido) => !pedido.foto_entrega_drive_id)) return setErro('Compartilhe e salve a foto geral antes de concluir a expedição.')
    setProcessando(true)
    const ids = pedidosSelecionados.map((pedido) => pedido.id)
    const { error } = await supabase.from('pedido').update({ status: 'entregue', entregue_em: new Date().toISOString() }).in('id', ids)
    setProcessando(false)
    if (error) setErro(error.message)
    else {
      setPedidos((atuais) => atuais.filter((pedido) => !selecionados.has(pedido.id)))
      setSelecionados(new Set())
      setFoto(null)
      setMsg(`${ids.length} pedido(s) marcados como entregues.`)
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <header>
        <h1 style={{ fontSize: 22 }}>🚚 Expedição</h1>
        <div className="hint">Escolha a data, revise os pedidos, tire uma foto geral e compartilhe uma única mensagem.</div>
      </header>
      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelBody grid" style={{ gap: 12 }}>
          <div className="row" style={{ alignItems: 'end' }}>
            <div className="field" style={{ maxWidth: 240 }}>
              <label htmlFor="data-expedicao">Data dos pedidos</label>
              <input id="data-expedicao" type="date" value={dataSelecionada} onChange={(e) => selecionarPedidosDaData(e.target.value)} />
            </div>
            <button className="btn" type="button" onClick={() => selecionarPedidosDaData(dataSelecionada)}>Selecionar pedidos desta data</button>
            <strong>{pedidosSelecionados.length} selecionado(s)</strong>
          </div>
          <div className="field">
            <label htmlFor="foto-expedicao">Foto geral da entrega</label>
            <input id="foto-expedicao" type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            {foto ? <span className="hint">Selecionada: {foto.name}</span> : null}
          </div>
          {pedidosSelecionados.length ? (
            <div className="field">
              <label>Prévia da mensagem geral</label>
              <div style={{ whiteSpace: 'pre-wrap', border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg)', lineHeight: 1.5 }}>
                {mensagemLote(pedidosSelecionados)}
              </div>
            </div>
          ) : null}
          <div className="row">
            <button className="btn btnSuccess" type="button" disabled={!foto || !pedidosSelecionados.length || processando} onClick={() => void compartilharLote()}>{processando ? 'Preparando…' : 'Compartilhar 1 foto + mensagem geral'}</button>
            <button className="btn btnPrimary" type="button" disabled={!pedidosSelecionados.length || processando} onClick={() => void marcarLoteEntregue()}>Marcar selecionados como entregues</button>
            <button className="btn" type="button" onClick={() => void carregar()}>Atualizar</button>
          </div>
        </div>
      </section>

      {loading ? <section className="panel"><div className="panelBody hint">Carregando expedição…</div></section> : null}
      {!loading && grupos.length === 0 ? <section className="panel"><div className="panelBody hint">Nenhum pedido aguardando expedição.</div></section> : null}
      {grupos.map(([condominio, itens]) => (
        <section className="panel" key={condominio}>
          <div className="panelHeader"><div><h2 style={{ fontSize: 18 }}>🏢 {condominio}</h2><div className="hint">{itens.length} pedido(s)</div></div></div>
          <div className="panelBody grid" style={{ gap: 8 }}>
            {itens.map((pedido) => (
              <label key={pedido.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: selecionados.has(pedido.id) ? '2px solid var(--accent)' : '1px solid var(--border)', borderRadius: 12, padding: 12, cursor: 'pointer', background: selecionados.has(pedido.id) ? 'var(--accent-bg)' : 'transparent' }}>
                <input type="checkbox" checked={selecionados.has(pedido.id)} onChange={() => alternarPedido(pedido.id)} style={{ width: 20, height: 20 }} />
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block', color: 'var(--text-h)' }}>{pedido.cliente?.nome ?? 'Cliente não encontrado'}</strong>
                  <span>{localCliente(pedido) || 'Bloco e apartamento não cadastrados'}</span>
                  <span className="hint" style={{ display: 'block' }}>Pedido: {dataBR(pedido.data_pedido)} · {Number(pedido.peso_kg).toLocaleString('pt-BR')} kg</span>
                </span>
                {pedido.data_pedido === dataSelecionada ? <span className="badge badgeGreen">Data escolhida</span> : null}
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
