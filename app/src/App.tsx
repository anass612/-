import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { AssetList } from './pages/assets/AssetList'
import { AssetDetail } from './pages/assets/AssetDetail'
import { AssembleDevice } from './pages/assets/AssembleDevice'
import { DisassembleDevice } from './pages/assets/DisassembleDevice'
import { ClientList } from './pages/clients/ClientList'
import { ClientDetail } from './pages/clients/ClientDetail'
import { DeployAsset } from './pages/deployments/DeployAsset'
import { RetrieveAsset } from './pages/deployments/RetrieveAsset'
import { Inventory } from './pages/inventory/Inventory'
import { Tasks } from './pages/tasks/Tasks'
import { TaskDetail } from './pages/tasks/TaskDetail'
import { MyTasks } from './pages/tasks/MyTasks'
import { Reports } from './pages/reports/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />

            <Route path="/assets" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><AssetList /></ProtectedRoute>} />
            <Route path="/assets/assemble" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><AssembleDevice /></ProtectedRoute>} />
            <Route path="/assets/disassemble" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><DisassembleDevice /></ProtectedRoute>} />
            <Route path="/assets/:id" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><AssetDetail /></ProtectedRoute>} />

            <Route path="/clients" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><ClientList /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><ClientDetail /></ProtectedRoute>} />

            <Route path="/deployments/deploy" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><DeployAsset /></ProtectedRoute>} />
            <Route path="/deployments/retrieve" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><RetrieveAsset /></ProtectedRoute>} />

            <Route path="/inventory" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Inventory /></ProtectedRoute>} />

            <Route path="/tasks" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Tasks /></ProtectedRoute>} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/my-tasks" element={<ProtectedRoute roles={['technician']}><MyTasks /></ProtectedRoute>} />

            <Route path="/reports" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Reports /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
