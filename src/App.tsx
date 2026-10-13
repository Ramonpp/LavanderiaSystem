import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { AppShell } from './app/AppShell'
import { LoginPage } from './pages/LoginPage'
const ClientesPage = lazy(() => import('./pages/ClientesPage').then((m) => ({ default: m.ClientesPage })))
const ConfigWebhookPage = lazy(() => import('./pages/ConfigWebhookPage').then((m) => ({ default: m.ConfigWebhookPage })))
const CustosMaquinasPage = lazy(() => import('./pages/CustosMaquinasPage').then((m) => ({ default: m.CustosMaquinasPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const DespesasPage = lazy(() => import('./pages/DespesasPage').then((m) => ({ default: m.DespesasPage })))
const MaquinasPage = lazy(() => import('./pages/MaquinasPage').then((m) => ({ default: m.MaquinasPage })))
const CriarPedidoPage = lazy(() => import('./pages/CriarPedidoPage').then((m) => ({ default: m.CriarPedidoPage })))
const PedidosCadastradosPage = lazy(() => import('./pages/PedidosCadastradosPage').then((m) => ({ default: m.PedidosCadastradosPage })))
const EmLavagemPage = lazy(() => import('./pages/EmLavagemPage').then((m) => ({ default: m.EmLavagemPage })))
const RelatorioMensalPage = lazy(() => import('./pages/RelatorioMensalPage').then((m) => ({ default: m.RelatorioMensalPage })))
const RelatorioAnualPage = lazy(() => import('./pages/RelatorioAnualPage').then((m) => ({ default: m.RelatorioAnualPage })))
const RelatorioPecasPage = lazy(() => import('./pages/RelatorioPecasPage').then((m) => ({ default: m.RelatorioPecasPage })))
const SimulacaoPage = lazy(() => import('./pages/SimulacaoPage').then((m) => ({ default: m.SimulacaoPage })))
const TiposPecaPage = lazy(() => import('./pages/TiposPecaPage').then((m) => ({ default: m.TiposPecaPage })))
const ManchasPage = lazy(() => import('./pages/ManchasPage').then((m) => ({ default: m.ManchasPage })))
const PedidosMensaisPage = lazy(() => import('./pages/PedidosMensaisPage').then((m) => ({ default: m.PedidosMensaisPage })))
const PedidosUsouPagouPage = lazy(() => import('./pages/PedidosUsouPagouPage').then((m) => ({ default: m.PedidosUsouPagouPage })))
const HistoricoPedidosPage = lazy(() => import('./pages/HistoricoPedidosPage').then((m) => ({ default: m.HistoricoPedidosPage })))
const FluxoEmpresaPage = lazy(() => import('./pages/FluxoEmpresaPage').then((m) => ({ default: m.FluxoEmpresaPage })))
const CobrancasPage = lazy(() => import('./pages/CobrancasPage').then((m) => ({ default: m.CobrancasPage })))
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
    <Suspense fallback={<div className="panel"><div className="panelBody hint">Carregando…</div></div>}>
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
        <Route path="/pedidos/mensais" element={<PedidosMensaisPage />} />
        <Route path="/pedidos/usou-pagou" element={<PedidosUsouPagouPage />} />
        <Route path="/pedidos/historico" element={<HistoricoPedidosPage />} />
        <Route path="/cobrancas" element={<CobrancasPage />} />
        <Route path="/pedidos" element={<Navigate to="/pedidos/lista" replace />} />
        <Route path="/pecas" element={<TiposPecaPage />} />
        <Route path="/despesas/criar" element={<DespesasPage mode="criar" />} />
        <Route path="/despesas/lista" element={<DespesasPage mode="lista" />} />
        <Route path="/despesas" element={<Navigate to="/despesas/lista" replace />} />
        <Route path="/maquinas" element={<MaquinasPage />} />
        <Route path="/custos" element={<CustosMaquinasPage />} />
        <Route path="/relatorios/mensal" element={<RelatorioMensalPage />} />
        <Route path="/relatorios/anual" element={<RelatorioAnualPage />} />
        <Route path="/relatorios/pecas" element={<RelatorioPecasPage />} />
        <Route path="/relatorios" element={<Navigate to="/relatorios/mensal" replace />} />
        <Route path="/simulacao" element={<SimulacaoPage />} />
        <Route path="/configuracoes" element={<ConfigWebhookPage />} />
        <Route path="/manchas" element={<ManchasPage />} />
        <Route path="/fluxo-empresa" element={<FluxoEmpresaPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
    </Suspense>
  )
}

