import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBanner } from '../components/StatusBanner'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMsg(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (authError) {
        setError(authError.message === 'Invalid login credentials' 
          ? 'E-mail ou senha incorretos. Verifique suas credenciais.' 
          : authError.message
        )
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao realizar o login.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Por favor, digite seu e-mail no campo "E-mail" acima primeiro para podermos enviar o link de recuperação.')
      return
    }

    setLoading(true)
    setError(null)
    setMsg(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/configuracoes',
      })

      if (resetError) {
        setError(resetError.message)
      } else {
        setMsg('E-mail de recuperação enviado! Verifique sua caixa de entrada.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao tentar recuperar a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '20px',
      fontFamily: 'var(--sans)',
    }}>
      <div className="panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '32px 24px',
        boxShadow: 'var(--shadow-raised)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        background: 'var(--panel)',
      }}>
        {/* Header/Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textAlign: 'center' }}>
          <img 
            src="/logo.png" 
            alt="Logo Ciclo Novo" 
            style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '14px', 
              objectFit: 'contain', 
              marginBottom: '8px',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)'
            }} 
          />
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-h)', margin: 0 }}>
            Ciclo Novo
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            Insira suas credenciais do Supabase para acessar a lavanderia
          </p>
        </div>

        {error && <StatusBanner kind="error" message={error} />}
        {msg && <StatusBanner kind="success" message={msg} />}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              style={{ width: '100%' }}
              disabled={loading}
            />
          </div>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="password" style={{ margin: 0 }}>Senha</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  fontWeight: 650,
                  cursor: 'pointer',
                  padding: 0,
                  fontFamily: 'var(--sans)',
                }}
                disabled={loading}
              >
                Esqueci a senha
              </button>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%' }}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btnPrimary"
            style={{ width: '100%', minHeight: '44px', fontSize: '14px', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Processando...' : 'Entrar no sistema'}
          </button>
        </form>

        {/* Hint about persistence */}
        <div style={{
          padding: '12px',
          borderRadius: 'var(--radius)',
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          fontSize: '12px',
          color: 'var(--text)',
          lineHeight: '1.4',
        }}>
          💡 <strong>Dica para Celular:</strong> O sistema mantém a conexão ativa. Ao acessar no celular, você pode <strong>"Adicionar à Tela de Início"</strong> (no menu do navegador) para usar como se fosse um aplicativo, sem precisar digitar a senha toda vez.
        </div>
      </div>
    </div>
  )
}
