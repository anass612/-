import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { LanguageProvider } from './i18n/LanguageContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppShell } from './components/rime/AppShell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/rime/Dashboard'
import { AssetList } from './pages/rime/AssetList'
import { DeviceHistory } from './pages/rime/DeviceHistory'
import { Assembly } from './pages/rime/Assembly'
import { Teardown } from './pages/rime/Teardown'
import { DeployRetrieve } from './pages/rime/DeployRetrieve'
import { DeploymentBackfill } from './pages/rime/DeploymentBackfill'
import { AuditLog } from './pages/rime/AuditLog'
import { ClientList } from './pages/clients/ClientList'
import { BranchHistory } from './pages/rime/BranchHistory'
import { Alerts } from './pages/rime/Alerts'
import { Stock } from './pages/rime/Stock'
import { Inventory } from './pages/inventory/Inventory'
import { Reports } from './pages/rime/Reports'
import { InvoiceList } from './pages/rime/InvoiceList'
import { InvoiceEntry } from './pages/rime/InvoiceEntry'
import { Tasks } from './pages/tasks/Tasks'
import { TaskDetail } from './pages/rime/technician/TaskDetail'
import { TaskList as TechnicianTaskList } from './pages/rime/technician/TaskList'

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />

              <Route path="/assets" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><AssetList /></ProtectedRoute>} />
              <Route path="/assets/:id" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><DeviceHistory /></ProtectedRoute>} />

              <Route path="/assembly" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Assembly /></ProtectedRoute>} />
              <Route path="/assembly/teardown" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Teardown /></ProtectedRoute>} />

              <Route path="/deployments" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><DeployRetrieve /></ProtectedRoute>} />
              <Route path="/deployments/backfill" element={<ProtectedRoute roles={['admin']}><DeploymentBackfill /></ProtectedRoute>} />

              <Route path="/clients" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><ClientList /></ProtectedRoute>} />
              <Route path="/clients/:id" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><BranchHistory /></ProtectedRoute>} />

              <Route path="/alerts" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Alerts /></ProtectedRoute>} />

              <Route path="/stock" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Stock /></ProtectedRoute>} />
              <Route path="/stock/catalog" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Inventory /></ProtectedRoute>} />

              <Route path="/invoices" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><InvoiceList /></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><InvoiceEntry /></ProtectedRoute>} />

              <Route path="/reports" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Reports /></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute roles={['admin']}><AuditLog /></ProtectedRoute>} />

              <Route path="/tasks" element={<ProtectedRoute roles={['admin', 'warehouse_staff']}><Tasks /></ProtectedRoute>} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/my-tasks" element={<ProtectedRoute roles={['technician']}><TechnicianTaskList /></ProtectedRoute>} />
            </Route>
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  )
}
