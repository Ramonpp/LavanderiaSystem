import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatusBanner } from '../components/StatusBanner'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--accent) 0%, #16a34a 100%)',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '18px',
            fontWeight: 800,
            marginBottom: '8px'
          }}>
            CN
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-h)', margin: 0 }}>
            Ciclo Novo
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            Insira suas credenciais do Supabase para acessar a lavanderia
          </p>
        </div>

        {error && <StatusBanner kind="error" message={error} />}

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
            <label htmlFor="password">Senha</label>
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
            {loading ? 'Entrando...' : 'Entrar no sistema'}
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
