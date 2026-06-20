import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { AppShell } from './app/AppShell'
import { LoginPage } from './pages/LoginPage'
import { ClientesPage } from './pages/ClientesPage'
import { ConfigWebhookPage } from './pages/ConfigWebhookPage'
import { CustosMaquinasPage } from './pages/CustosMaquinasPage'
import { DashboardPage } from './pages/DashboardPage'
import { DespesasPage } from './pages/DespesasPage'
import { MaquinasPage } from './pages/MaquinasPage'
import { CriarPedidoPage } from './pages/CriarPedidoPage'
import { PedidosCadastradosPage } from './pages/PedidosCadastradosPage'
import { EmLavagemPage } from './pages/EmLavagemPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { SimulacaoPage } from './pages/SimulacaoPage'
import { TiposPecaPage } from './pages/TiposPecaPage'

export default function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Busca sessão inicial
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setLoading(false)
    })

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg)'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clientes/criar" element={<ClientesPage mode="criar" />} />
        <Route path="/clientes/lista" element={<ClientesPage mode="lista" />} />
        <Route path="/clientes" element={<Navigate to="/clientes/lista" replace />} />
        <Route path="/pedidos/criar" element={<CriarPedidoPage />} />
        <Route path="/pedidos/lista" element={<PedidosCadastradosPage />} />
        <Route path="/pedidos/em-lavagem" element={<EmLavagemPage />} />
        <Route path="/pedidos" element={<Navigate to="/pedidos/lista" replace />} />
        <Route path="/pecas" element={<TiposPecaPage />} />
        <Route path="/despesas/criar" element={<DespesasPage mode="criar" />} />
        <Route path="/despesas/lista" element={<DespesasPage mode="lista" />} />
        <Route path="/despesas" element={<Navigate to="/despesas/lista" replace />} />
        <Route path="/maquinas" element={<MaquinasPage />} />
        <Route path="/custos" element={<CustosMaquinasPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/simulacao" element={<SimulacaoPage />} />
        <Route path="/configuracoes" element={<ConfigWebhookPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

