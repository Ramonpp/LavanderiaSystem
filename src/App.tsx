import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { ClientesPage } from './pages/ClientesPage'
import { ConfigWebhookPage } from './pages/ConfigWebhookPage'
import { CustosMaquinasPage } from './pages/CustosMaquinasPage'
import { DashboardPage } from './pages/DashboardPage'
import { DespesasPage } from './pages/DespesasPage'
import { MaquinasPage } from './pages/MaquinasPage'
import { PedidosPage } from './pages/PedidosPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { SimulacaoPage } from './pages/SimulacaoPage'
import { TiposPecaPage } from './pages/TiposPecaPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/pecas" element={<TiposPecaPage />} />
        <Route path="/despesas" element={<DespesasPage />} />
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
