import { useEffect, useState } from 'react'
import { fetchAppConfig, updateAppConfig } from '../data/appConfig'
import { StatusBanner } from '../components/StatusBanner'
import { supabase } from '../lib/supabase'

export function ConfigWebhookPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const [registrandoBiometria, setRegistrandoBiometria] = useState(false)
  const [biometriaSucesso, setBiometriaSucesso] = useState<string | null>(null)
  const [biometriaErro, setBiometriaErro] = useState<string | null>(null)
  const [isPasskeySupported, setIsPasskeySupported] = useState(false)

  useEffect(() => {
    if (window.PublicKeyCredential && 
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(result => {
        setIsPasskeySupported(result)
      })
    }
  }, [])

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

  async function cadastrarBiometria() {
    setRegistrandoBiometria(true)
    setBiometriaSucesso(null)
    setBiometriaErro(null)

    try {
      // @ts-ignore - experimental API
      const { data, error } = await supabase.auth.registerPasskey()
      if (error) {
        setBiometriaErro(error.message)
      } else if (data) {
        setBiometriaSucesso('Biometria cadastrada com sucesso neste dispositivo! Agora você poderá entrar usando Face ID, digital ou PIN local.')
      }
    } catch (err: any) {
      setBiometriaErro(err.message || 'Não foi possível cadastrar a biometria ou a operação foi cancelada.')
    } finally {
      setRegistrandoBiometria(false)
    }
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      <header>
        <h1 style={{ fontSize: 22, letterSpacing: -0.2 }}>Configurações</h1>
        <div className="hint">
          Cadastre um webhook para cobrança ou gerencie seu login biométrico por este dispositivo.
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

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panelHeader">
          <h2 style={{ fontSize: 16 }}>Acesso por Biometria (Face ID / Digital)</h2>
        </div>
        <div className="panelBody grid" style={{ gap: 12 }}>
          <p className="hint" style={{ margin: 0 }}>
            Cadastre o Face ID, Touch ID (digital) ou PIN deste dispositivo para acessar o sistema de forma rápida e segura sem precisar digitar suas credenciais.
          </p>

          {biometriaErro && <StatusBanner kind="error" message={biometriaErro} />}
          {biometriaSucesso && <StatusBanner kind="success" message={biometriaSucesso} />}

          {!isPasskeySupported ? (
            <div className="hint" style={{ color: 'var(--warning)', fontWeight: 650 }}>
              ⚠️ Este dispositivo ou navegador não suporta autenticação biométrica local (Passkeys/WebAuthn).
            </div>
          ) : (
            <button 
              className="btn btnPrimary" 
              type="button" 
              onClick={() => void cadastrarBiometria()}
              disabled={registrandoBiometria}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              {registrandoBiometria ? 'Registrando...' : 'Registrar Biometria / Passkey'}
            </button>
          )}
          
          <div className="hint" style={{ marginTop: 4, background: 'var(--code-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', lineHeight: '1.4' }}>
            💡 <strong>Nota:</strong> É necessário ter ativado a opção de <strong>Passkeys</strong> no menu de autenticação do console do seu Supabase para habilitar o registro.
          </div>
        </div>
      </section>
    </div>
  )
}

