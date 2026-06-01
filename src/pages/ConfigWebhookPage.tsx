import { useEffect, useState } from 'react'
import { fetchAppConfig, updateAppConfig } from '../data/appConfig'
import { StatusBanner } from '../components/StatusBanner'

export function ConfigWebhookPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function reload() {
    setErro(null)
    setMsg(null)
    const { data, error } = await fetchAppConfig()
    if (error) setErro(error)
    setWebhookUrl(data?.webhook_url ?? '')
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [])

  async function salvar() {
    setErro(null)
    setMsg(null)
    const { error } = await updateAppConfig({
      webhook_url: webhookUrl.trim().length === 0 ? null : webhookUrl.trim(),
    })
    if (error) setErro(error)
    else setMsg('Webhook salvo.')
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Configurações</h1>
        <div className="hint">
          Cadastre um webhook para envio de mensagens de cobrança (ex.: automação do WhatsApp / CRM).
        </div>
      </header>

      {erro ? <StatusBanner kind="error" message={erro} /> : null}
      {msg ? <StatusBanner kind="success" message={msg} /> : null}

      <section className="panel">
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Webhook</h2>
          <button className="btn" type="button" onClick={() => void reload()}>
            Recarregar
          </button>
        </div>
        <div className="panelBody grid" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="wh">URL do webhook</label>
            <input
              id="wh"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://..."
            />
            <div className="hint" style={{ marginTop: 6 }}>
              Ao clicar em “Enviar cobrança”, o sistema faz um POST para esta URL com os dados do pedido.
            </div>
          </div>

          <button className="btn btnPrimary" type="button" onClick={() => void salvar()}>
            Salvar
          </button>
        </div>
      </section>
    </div>
  )
}

