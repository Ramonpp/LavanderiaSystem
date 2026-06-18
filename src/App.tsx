import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { ClientesPage } from './pages/ClientesPage'
import { ConfigWebhookPage } from './pages/ConfigWebhookPage'
import { CustosMaquinasPage } from './pages/CustosMaquinasPage'
import { DashboardPage } from './pages/DashboardPage'
import { DespesasPage } from './pages/DespesasPage'
import { MaquinasPage } from './pages/MaquinasPage'
import { CriarPedidoPage } from './pages/CriarPedidoPage'
import { PedidosCadastradosPage } from './pages/PedidosCadastradosPage'
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
        <Route path="/pedidos/criar" element={<CriarPedidoPage />} />
        <Route path="/pedidos/lista" element={<PedidosCadastradosPage />} />
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
