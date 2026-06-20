import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  fetchItensPorPedidos,
  fetchPedidos,
  insertPedidoComItens,
  replaceItensPedido,
  updatePedido,
} from '../data/pedidos'
import { fetchClientes } from '../data/clientes'
import { fetchTiposPeca } from '../data/tiposPeca'
import type { Cliente, ItemPedido, OrderStatus, PagamentoStatus, PedidoCliente, TipoPeca } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'
import { compressImage } from '../utils/image'

type ItemLinha = {
  key: string
  tipo_peca_id: string
  quantidade: string
}

function newKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const PEDIDO_MINIMO: Array<{ nome: string; quantidade: string }> = [
  { nome: 'Toalha de piso', quantidade: '1' },
  { nome: 'Toalha de banho', quantidade: '2' },
  { nome: 'Toalha de rosto', quantidade: '1' },
  { nome: 'Lencol casal', quantidade: '1' },
  { nome: 'Fronha', quantidade: '2' },
]

function resolverTipoId(tipos: import('../types/models').TipoPeca[], nome: string): string {
  const n = nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  return tipos.find((t) =>
    t.nome.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '') === n,
  )?.id ?? ''
}

function gerarLinhasPadrao(tipos: import('../types/models').TipoPeca[]): ItemLinha[] {
  const linhas = PEDIDO_MINIMO
    .map(({ nome, quantidade }) => ({
      key: newKey(),
      tipo_peca_id: resolverTipoId(tipos, nome),
      quantidade,
    }))
    .filter((l) => l.tipo_peca_id !== '')
  return linhas.length > 0 ? linhas : [{ key: newKey(), tipo_peca_id: tipos[0]?.id ?? '', quantidade: '1' }]
}

const statusOpções: OrderStatus[] = ['recebido', 'em_lavagem', 'pronto', 'entregue', 'cancelado']
const pagamentoOpcoes: { value: PagamentoStatus; label: string }[] = [
  { value: 'pago', label: 'Pago' },
  { value: 'devendo', label: 'Devendo' },
  { value: 'em_andamento', label: 'Em Andamento' },
]

export function CriarPedidoPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tipos, setTipos] = useState<TipoPeca[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [dataPedido, setDataPedido] = useState(() => new Date().toISOString().slice(0, 10))
  const [dataPrev, setDataPrev] = useState('')
  const [status, setStatus] = useState<OrderStatus>('recebido')
  const [pagamentoStatus, setPagamentoStatus] = useState<PagamentoStatus>('devendo')
  const [pesoKg, setPesoKg] = useState('')

  type PricingMode = 'kg' | 'fixo'
  const [modoPreco, setModoPreco] = useState<PricingMode>('kg')
  const [precoKg, setPrecoKg] = useState('15')
  const [precoFixo, setPrecoFixo] = useState('')

  const [observacoes, setObservacoes] = useState('')

  const [itensLinhas, setItensLinhas] = useState<ItemLinha[]>([])

  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [fotoDriveIdExistente, setFotoDriveIdExistente] = useState<string | null>(null)

  function formatarNomeCliente(c: { nome: string; condominio?: string | null; bloco?: string | null; apartamento?: string | null } | null) {
    if (!c) return '—'
    const parts = []
    if (c.apartamento?.trim()) parts.push(c.apartamento.trim())
    if (c.bloco?.trim()) parts.push(c.bloco.trim())
    return parts.length > 0 ? `${c.nome} (${parts.join(' ')})` : c.nome
  }

  const primeiraPecaDisponível = useMemo(() => tipos[0]?.id ?? '', [tipos])
  const DEFAULT_PRECO_POR_KG_48H = '15'

  async function reloadAll() {
    setErro(null)
    const [peds, cls, tp] = await Promise.all([
      fetchPedidos(),
      fetchClientes(true),
      fetchTiposPeca(),
    ])

    setClientes(cls.data)
    setTipos(tp.data)

    const e = peds.error ?? cls.error ?? tp.error ?? null
    if (e) setErro(e)

    const searchParams = new URLSearchParams(location.search)
    const editIdParam = searchParams.get('edit')
    if (editIdParam) {
      const pToEdit = peds.data.find(x => x.id === editIdParam)
      if (pToEdit) {
        preencherEdição(pToEdit)
        return
      }
    }

    setClienteId((cur) => {
      if (cur) return cur
      const primeiro = cls.data.find((c) => c.ativo)?.id ?? cls.data[0]?.id
      return primeiro ?? ''
    })

    setItensLinhas((cur) => (cur.length > 0 ? cur : gerarLinhasPadrao(tp.data)))
  }

  useEffect(() => {
    void reloadAll()
  }, [])

  useEffect(() => {
    if (editandoId) return
    setModoPreco('kg')
    setPrecoKg(DEFAULT_PRECO_POR_KG_48H)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editandoId])

  function limparForm() {
    setEditandoId(null)
    const d = new Date().toISOString().slice(0, 10)
    setDataPedido(d)
    setDataPrev(addDaysIso(d, 2))
    setStatus('recebido')
    setPagamentoStatus('devendo')
    setPesoKg('')
    setModoPreco('kg')
    setPrecoKg('15')
    setPrecoFixo('')
    setObservacoes('')
    setItensLinhas(gerarLinhasPadrao(tipos))
    setMsg(null)
    setFotoFile(null)
    setFotoPreview(null)
    setFotoDriveIdExistente(null)
  }

  function adicionarLinhaItem() {
    const key = newKey()
    setItensLinhas((xs) => [
      ...xs,
      { key, tipo_peca_id: primeiraPecaDisponível, quantidade: '1' },
    ])
    setTimeout(() => {
      const el = document.getElementById(`item-row-${key}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const select = el.querySelector('select')
        if (select) select.focus()
      }
    }, 100)
  }

  function removerLinhaItem(key: string) {
    setItensLinhas((xs) => (xs.length <= 1 ? xs : xs.filter((x) => x.key !== key)))
  }

  async function preencherEdição(p: PedidoCliente) {
    setErro(null)
    setMsg(null)
    setEditandoId(p.id)
    setClienteId(p.cliente_id)
    setDataPedido(p.data_pedido)
    setDataPrev(p.data_prevista_entrega ?? '')
    setStatus(p.status)
    setPagamentoStatus(p.pagamento_status ?? 'devendo')
    setPesoKg(String(p.peso_kg ?? ''))
    setFotoDriveIdExistente(p.foto_drive_id ?? null)
    setFotoFile(null)
    setFotoPreview(null)

    const temFixo = p.preco_fixo != null
    const temKg = p.preco_por_kg != null
    if (temFixo && !temKg) setModoPreco('fixo')
    else setModoPreco('kg')
    setPrecoKg(p.preco_por_kg == null ? '' : String(p.preco_por_kg))
    setPrecoFixo(p.preco_fixo == null ? '' : String(p.preco_fixo))
    setObservacoes(p.observacoes ?? '')

    const { data } = await fetchItensPorPedidos([p.id])
    const linhas: ItemLinha[] =
      data.length > 0
        ? data.map((it) => ({
          key: it.id ?? newKey(),
          tipo_peca_id: it.tipo_peca_id,
          quantidade: String(it.quantidade),
        }))
        : [{ key: newKey(), tipo_peca_id: primeiraPecaDisponível, quantidade: '1' }]
    setItensLinhas(linhas)
  }

  function montarItensPersistência(): Omit<ItemPedido, 'id' | 'pedido_id' | 'criado_em'>[] {
    const resultado: Omit<ItemPedido, 'id' | 'pedido_id' | 'criado_em'>[] = []

    for (const l of itensLinhas) {
      if (!l.tipo_peca_id) continue

      const q = Math.round(Number(String(l.quantidade).replace(',', '.')))
      if (!Number.isFinite(q) || q <= 0) {
        continue
      }

      resultado.push({
        tipo_peca_id: l.tipo_peca_id,
        quantidade: q,
        peso_linha_kg: null,
      })
    }

    return resultado
  }

  function addDaysIso(iso: string, days: number) {
    const d = new Date(`${iso}T00:00:00`)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  useEffect(() => {
    if (editandoId) return
    if (dataPedido) setDataPrev(addDaysIso(dataPedido, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataPedido, editandoId])
  async function salvarPedido() {
    setErro(null)
    setMsg(null)

    if (!clienteId) {
      setErro('Selecione um cliente.')
      return
    }
    const peso = Number(String(pesoKg).replace(',', '.'))
    if (!Number.isFinite(peso) || peso < 0) {
      setErro('Peso (kg) inválido.')
      return
    }

    const pk = Number(String(precoKg).replace(',', '.'))
    const pf = Number(String(precoFixo).replace(',', '.'))

    let preco_por_kg: number | null = null
    let preco_fixo: number | null = null

    if (modoPreco === 'kg') {
      if (!Number.isFinite(pk) || pk < 0) {
        setErro('Preço por kg inválido.')
        return
      }
      preco_por_kg = pk
      preco_fixo = null
    } else {
      if (!Number.isFinite(pf) || pf < 0) {
        setErro('Preço fixo inválido.')
        return
      }
      preco_fixo = pf
      preco_por_kg = null
    }

    const itensLimpos = montarItensPersistência()
    if (itensLimpos.length === 0) {
      setErro('Informe ao menos uma linha de item com tipo e quantidade válida.')
      return
    }

    let uploadedFileId: string | null = null
    if (fotoFile) {
      setEnviandoFoto(true)
      try {
        const compressedBlob = await compressImage(fotoFile)
        const clientObj = clientes.find((c) => c.id === clienteId)
        const clientName = clientObj ? clientObj.nome : 'Cliente Desconhecido'

        const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL
        if (!webhookUrl) {
          throw new Error('Webhook do N8N não configurado. Por favor, adicione VITE_N8N_WEBHOOK_URL no seu arquivo .env.local.')
        }

        // Criar FormData para enviar para o N8N
        const formData = new FormData()
        formData.append('clientName', clientName)
        formData.append('date', dataPedido)
        formData.append('file', compressedBlob, `pesagem_${Date.now()}.jpg`)

        const response = await fetch(webhookUrl, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Erro de resposta do Webhook N8N: Status ${response.status}`)
        }

        // Se o N8N retornar o ID do arquivo (opcional), salvamos no banco
        try {
          const resData = await response.json()
          // Trata tanto um objeto quanto um array com um objeto que é comum no n8n
          const firstItem = Array.isArray(resData) ? resData[0] : resData
          if (firstItem && firstItem.fileId) {
            uploadedFileId = firstItem.fileId
          }
        } catch (e) {
          // Ignorar se n8n responder com texto simples (ex: "Workflow started")
        }
      } catch (err: any) {
        setErro(`Erro no upload da foto: ${err.message}`)
        setEnviandoFoto(false)
        return
      }
      setEnviandoFoto(false)
    }

    const pedidoBase = {
      cliente_id: clienteId,
      data_pedido: dataPedido,
      data_prevista_entrega: dataPrev.trim().length === 0 ? null : dataPrev,
      status,
      pagamento_status: pagamentoStatus,
      peso_kg: peso,
      preco_por_kg,
      preco_fixo,
      observacoes: observacoes.trim().length === 0 ? null : observacoes.trim(),
      foto_drive_id: uploadedFileId || fotoDriveIdExistente,
    }

    if (editandoId) {
      const { error: u } = await updatePedido(editandoId, pedidoBase)
      if (u) {
        if (u.includes('foto_drive_id')) {
          setErro('Erro no banco: a coluna "foto_drive_id" não existe. Por favor, execute o script SQL de migração no painel do Supabase.')
        } else {
          setErro(u)
        }
        return
      }
      const { error: r } = await replaceItensPedido(editandoId, itensLimpos)
      if (r) {
        setErro(r)
        return
      }
      setMsg('Pedido atualizado.')
      limparForm()
    } else {
      const { error: ins } = await insertPedidoComItens({
        pedido: pedidoBase,
        itens: itensLimpos,
      })
      if (ins) {
        if (ins.includes('foto_drive_id')) {
          setErro('Erro no banco: a coluna "foto_drive_id" não existe. Por favor, execute o script SQL de migração no painel do Supabase.')
        } else {
          setErro(ins)
        }
        return
      }
      setMsg('Pedido criado.')
      limparForm()
      navigate('/pedidos/lista')
    }

    await reloadAll()
  }  useEffect(() => {
    setItensLinhas((xs) =>
      xs.map((l) =>
        !l.tipo_peca_id && primeiraPecaDisponível
          ? { ...l, tipo_peca_id: primeiraPecaDisponível }
          : l,
      ),
    )
  }, [primeiraPecaDisponível])

  useEffect(() => {
    // Scroll to top or handle query params like ?edit=id if needed later
  }, [location.hash, location.key])

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Pedidos</h1>
        <div className="hint">
          Padrão sugerido: <strong>R$ 15/kg</strong> com entrega em <strong>48h</strong>. Ajuste por pedido quando necessário.
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel" id="criar-pedido">
        <div className="panelHeader" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, color: 'var(--accent)' }}>{editandoId ? 'Editar pedido' : 'Criar pedido'}</h2>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" type="button" onClick={limparForm}>
              Cancelar
            </button>
            <button className="btn" type="button" onClick={() => void reloadAll()} title="Recarregar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="hide-mobile">Recarregar</span>
            </button>
          </div>
        </div>
        <div className="panelBody grid" style={{ gap: 12, paddingTop: 0 }}>
          <div className="row">
            <div className="field">
              <label htmlFor="cli">Cliente</label>
              <select id="cli" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.length === 0 ? <option value="">Sem clientes</option> : null}
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {!c.ativo ? '(inativo) ' : ''}
                    {formatarNomeCliente(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="data">Data pedido</label>
              <input id="data" type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="prev">Previsão entrega</label>
              <input id="prev" type="date" value={dataPrev} onChange={(e) => setDataPrev(e.target.value)} />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="status">Status</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                {statusOpções.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll('_', ' ').replace(/^./, str => str.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pagto">Pagamento</label>
              <select id="pagto" value={pagamentoStatus} onChange={(e) => setPagamentoStatus(e.target.value as PagamentoStatus)}>
                {pagamentoOpcoes.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="peso">Peso total (kg)</label>
              <input id="peso" inputMode="decimal" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
            </div>
            <div className="field" style={{ alignSelf: 'end' }}>
              <label>Forma de cobrança</label>
              <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setModoPreco('kg')}
                  style={{
                    flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: modoPreco === 'kg' ? 'var(--panel)' : 'transparent',
                    color: modoPreco === 'kg' ? 'var(--text-h)' : 'var(--muted)',
                    boxShadow: modoPreco === 'kg' ? 'var(--shadow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Por KG
                </button>
                <button
                  type="button"
                  onClick={() => setModoPreco('fixo')}
                  style={{
                    flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: modoPreco === 'fixo' ? 'var(--panel)' : 'transparent',
                    color: modoPreco === 'fixo' ? 'var(--text-h)' : 'var(--muted)',
                    boxShadow: modoPreco === 'fixo' ? 'var(--shadow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Fixo
                </button>
              </div>
            </div>
          </div>

          <div className="row">
            {modoPreco === 'kg' ? (
              <div className="field">
                <label htmlFor="precoKg">Preço por kg (R$/kg)</label>
                <input id="precoKg" inputMode="decimal" value={precoKg} onChange={(e) => setPrecoKg(e.target.value)} />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="precoFixo">Preço fixo (R$)</label>
                <input id="precoFixo" inputMode="decimal" value={precoFixo} onChange={(e) => setPrecoFixo(e.target.value)} />
              </div>
            )}
            <div className="field" style={{ flex: '2 1 320px', minWidth: '100%' }}>
              <label htmlFor="obs">Observações</label>
              <textarea id="obs" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          </div>

          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div className="field" style={{ flex: '1 1 300px' }}>
              <label htmlFor="foto">Foto da Pesagem {fotoDriveIdExistente ? '(Já existe foto no Drive)' : '(Opcional)'}</label>
              <input
                id="foto"
                type="file"
                accept="image/*"
                disabled={enviandoFoto}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setFotoFile(file)
                    setFotoPreview(URL.createObjectURL(file))
                  }
                }}
              />
              {fotoDriveIdExistente && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href={`https://drive.google.com/file/d/${fotoDriveIdExistente}/view?usp=drivesdk`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ fontSize: 12, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Ver foto atual no Google Drive
                  </a>
                </div>
              )}
            </div>

            {fotoPreview && (
              <div className="field" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <label>Pré-visualização da Pesagem</label>
                <div style={{ position: 'relative', marginTop: 8 }}>
                  <img
                    src={fotoPreview}
                    alt="Preview da pesagem"
                    style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFotoFile(null)
                      setFotoPreview(null)
                    }}
                    style={{
                      position: 'absolute', top: -8, right: -8,
                      background: 'var(--danger)', color: 'white', border: 'none',
                      borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'var(--shadow)', fontWeight: 'bold'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          <section className="panel" style={{ boxShadow: 'none' }}>
            <div className="panelHeader">
              <h3 style={{ fontSize: 15 }}>Peças (escolha o tipo e a quantidade)</h3>
              <button
                type="button"
                onClick={adicionarLinhaItem}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px dashed var(--accent)',
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nova peça
              </button>
            </div>
            <div className="panelBody grid" style={{ gap: 10 }}>
              {itensLinhas.map((l) => (
                <div key={l.key} id={`item-row-${l.key}`} className="row responsive" style={{ gap: 10 }}>
                  <div className="field">
                    <label>Tipo peça</label>
                    <select value={l.tipo_peca_id} onChange={(e) => {
                      const v = e.target.value
                      setItensLinhas((xs) => xs.map((y) => (y.key === l.key ? { ...y, tipo_peca_id: v } : y)))
                    }}>
                      <option value="">Escolha</option>
                      {tipos.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Quantidade</label>
                    <input
                      inputMode="numeric"
                      value={l.quantidade}
                      onChange={(e) =>
                        setItensLinhas((xs) =>
                          xs.map((y) => (y.key === l.key ? { ...y, quantidade: e.target.value } : y)),
                        )
                      }
                    />
                  </div>
                  <div className="field" style={{ minWidth: 120, alignSelf: 'end' }}>
                    <label style={{ visibility: 'hidden' }}>X</label>
                    <button
                      type="button"
                      onClick={() => removerLinhaItem(l.key)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '42px', padding: '0 16px',
                        borderRadius: 8, border: '1px solid var(--danger)',
                        background: 'transparent',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      title="Remover peça"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {tipos.length === 0 ? (
                <div className="hint">Cadastre os tipos de peça na aba Peças para detalhar os itens do pedido.</div>
              ) : null}
            </div>
          </section>

          <button 
            className="btn btnPrimary" 
            type="button" 
            disabled={enviandoFoto} 
            onClick={() => void salvarPedido()}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {enviandoFoto ? 'Enviando foto ao Google Drive...' : 'Salvar pedido'}
          </button>
        </div>
      </section>
    </div>
  )
}
