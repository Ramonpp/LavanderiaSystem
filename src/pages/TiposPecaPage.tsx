import { useEffect, useState } from 'react'
import { deleteTipoPeca, fetchTiposPeca, insertTipoPeca, popularCatalogoPadrao, updateTipoPeca } from '../data/tiposPeca'
import type { TipoPeca } from '../types/models'
import { StatusBanner } from '../components/StatusBanner'

export function TiposPecaPage() {
  const [itens, setItens] = useState<TipoPeca[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [pesoRef, setPesoRef] = useState('')

  async function recarregar() {
    setErro(null)
    const { data, error } = await fetchTiposPeca()
    if (error) setErro(error)
    setItens(data)
  }

  useEffect(() => {
    void recarregar()
  }, [])

  function limpar() {
    setEditandoId(null)
    setNome('')
    setDescricao('')
    setPesoRef('')
    setMsg(null)
  }

  function editar(tp: TipoPeca) {
    setEditandoId(tp.id)
    setNome(tp.nome)
    setDescricao(tp.descricao ?? '')
    setPesoRef(tp.peso_referencia_kg == null ? '' : String(tp.peso_referencia_kg))
    setMsg(null)
  }

  async function salvar() {
    setErro(null)
    setMsg(null)
    if (!nome.trim()) {
      setErro('Nome da peça é obrigatório.')
      return
    }

    const pesoParsed = pesoRef.trim().length === 0 ? null : Number(pesoRef.replace(',', '.'))
    if (pesoParsed !== null && !Number.isFinite(pesoParsed)) {
      setErro('Peso de referência inválido.')
      return
    }

    if (editandoId) {
      const { error } = await updateTipoPeca(editandoId, {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        peso_referencia_kg: pesoParsed,
      })
      if (error) setErro(error)
      else {
        setMsg('Tipo atualizado.')
        limpar()
      }
    } else {
      const { error } = await insertTipoPeca({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        peso_referencia_kg: pesoParsed,
      })
      if (error) setErro(error)
      else {
        setMsg('Tipo cadastrado.')
        limpar()
      }
    }
    await recarregar()
  }

  async function excluir(tp: TipoPeca) {
    if (!window.confirm(`Excluir “${tp.nome}”? Se existir vínculos em pedidos, o SQL vai bloquear.`)) return
    setErro(null)
    const { error } = await deleteTipoPeca(tp.id)
    if (error) setErro(error)
    else await recarregar()
  }

  async function preencherPadrao() {
    setErro(null)
    setMsg(null)
    const { inseridos, error } = await popularCatalogoPadrao()
    if (error) { setErro(error); return }
    if (inseridos === 0) setMsg('Catálogo padrão já está completo — nenhuma peça nova foi adicionada.')
    else { setMsg(`${inseridos} peça(s) de enxoval adicionada(s) ao catálogo.`); await recarregar() }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Tipos de peça</h1>
        <div className="hint">
          Use para registrar enxoval (lençóis cobertores toalhas etc.) com peso médio opcional para conferências.
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>{editandoId ? 'Editar' : 'Novo tipo'}</h2>
          <button className="btn" type="button" onClick={limpar}>
            Cancelar
          </button>
        </div>
        <div className="panelBody grid" style={{ gap: 10 }}>
          <div className="row">
            <div className="field">
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pesoRef">Peso referência (kg, opcional)</label>
              <input id="pesoRef" inputMode="decimal" value={pesoRef} onChange={(e) => setPesoRef(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ minWidth: '100%' }}>
            <label htmlFor="desc">Descrição</label>
            <textarea id="desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <button className="btn btnPrimary" type="button" onClick={() => void salvar()}>
            Salvar
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Catálogo</h2>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btnPrimary" type="button" onClick={() => void preencherPadrao()}>
              Preencher catálogo padrão
            </button>
            <button className="btn" type="button" onClick={() => void recarregar()}>
              Recarregar
            </button>
          </div>
        </div>
        <div className="panelBody">
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Peso ref.</th>
                  <th>Descrição</th>
                  <th style={{ width: 210 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((tp) => (
                  <tr key={tp.id}>
                    <td style={{ fontWeight: 650 }}>{tp.nome}</td>
                    <td>{tp.peso_referencia_kg == null ? '—' : Number(tp.peso_referencia_kg).toLocaleString('pt-BR')}</td>
                    <td className="hint">{tp.descricao ?? '—'}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn" type="button" onClick={() => editar(tp)}>
                          Editar
                        </button>
                        <button className="btn btnDanger" type="button" onClick={() => void excluir(tp)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="hint">
                      Nenhum tipo cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
