import { useEffect, useState } from 'react'
import { checkDbHealth, type DbHealth } from '../lib/healthCheck'

let PROJECT_REF = '<project-ref>'
try {
  if (import.meta.env.VITE_SUPABASE_URL) {
    PROJECT_REF = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0]
  }
} catch (e) {
  // Ignorar erro de URL inválida
}

export function SetupBanner() {
  const [health, setHealth] = useState<DbHealth>('checking')

  useEffect(() => {
    checkDbHealth().then(setHealth)
  }, [])

  if (health === 'checking' || health === 'ok') return null

  if (health === 'unreachable') {
    return (
      <div style={bannerStyle('var(--danger)')}>
        <strong>Supabase não configurado</strong>
        <p style={pStyle}>
          Crie um arquivo <code>.env.local</code> na raiz do projeto com:
        </p>
        <pre style={preStyle}>
          {`VITE_SUPABASE_URL=https://<ref>.supabase.co\nVITE_SUPABASE_ANON_KEY=<chave anon>`}
        </pre>
      </div>
    )
  }

  // schema_missing
  return (
    <div style={bannerStyle('var(--warning)')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>⚠</span>
        <strong style={{ color: 'var(--text-h)' }}>Schema do banco não aplicado</strong>
      </div>
      <p style={pStyle}>
        O projeto Supabase está acessível mas as tabelas ainda não existem. Escolha uma das formas abaixo para aplicar o schema:
      </p>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div style={optionStyle}>
          <div style={optionTitle}>Opção 1 — Supabase Dashboard (mais rápido)</div>
          <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            <li>Abra <strong>supabase.com → seu projeto</strong></li>
            <li>Vá em <strong>SQL Editor</strong></li>
            <li>Cole e execute o conteúdo do arquivo <code>supabase/schema.sql</code></li>
          </ol>
        </div>

        <div style={optionStyle}>
          <div style={optionTitle}>Opção 2 — Supabase CLI (recomendado)</div>
          <p style={{ margin: '8px 0 4px', fontSize: 13 }}>Execute no terminal (substitua a senha do banco):</p>
          <pre style={preStyle}>
            {`npx supabase link --project-ref ${PROJECT_REF}\nnpx supabase db push`}
          </pre>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            A senha do banco está em: Supabase → Settings → Database → Database password
          </p>
        </div>
      </div>
    </div>
  )
}

function bannerStyle(borderColor: string): React.CSSProperties {
  return {
    background: 'var(--panel)',
    border: `1px solid ${borderColor}`,
    borderLeft: `4px solid ${borderColor}`,
    borderRadius: 12,
    padding: '14px 16px',
    display: 'grid',
    gap: 8,
  }
}

const pStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: 'var(--text)',
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 12px',
  background: 'var(--code-bg)',
  borderRadius: 8,
  fontSize: 12,
  fontFamily: 'var(--mono)',
  overflowX: 'auto',
  whiteSpace: 'pre',
}

const optionStyle: React.CSSProperties = {
  background: 'var(--code-bg)',
  borderRadius: 10,
  padding: '12px 14px',
}

const optionTitle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 13,
  color: 'var(--text-h)',
}
