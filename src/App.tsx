import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuestOnly, RequireAuth } from './components/RequireAuth'
import Dashboard from './pages/dashboard'
import LoginPage from './pages/login'
import MessagesPage from './pages/messages'
import ProfilePage from './pages/profile'
import AdminHerbsPage from './pages/admin/herbs'
import AdminHerbNewPage from './pages/admin/herbs/new'
import BuyerHerbsPage from './pages/buyer/herbs'
import GrowerDashboardPage from './pages/grower/dashboard'
import GrowerBatchesPage from './pages/grower/batches'
import GrowerBatchNewPage from './pages/grower/batches/new'
import GrowerLogsPage from './pages/grower/logs'
import GrowerLogNewPage from './pages/grower/logs/new'
import TraceDetailPage from './pages/trace/Detail'

const appTheme = {
  token: {
    colorPrimary: '#2f6f4e',
    borderRadius: 8,
    fontFamily: '"Segoe UI", system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={appTheme}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <GuestOnly>
                <LoginPage />
              </GuestOnly>
            }
          />
          <Route
            path="/login"
            element={
              <GuestOnly>
                <LoginPage />
              </GuestOnly>
            }
          />

          <Route
            path="/dashboard"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <MessagesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/herbs"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AdminHerbsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/herbs/new"
            element={
              <RequireAuth allowedRoles={['admin']}>
                <AdminHerbNewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/buyer/herbs"
            element={
              <RequireAuth allowedRoles={['buyer']}>
                <BuyerHerbsPage />
              </RequireAuth>
            }
          />

          <Route
            path="/grower/dashboard"
            element={
              <RequireAuth allowedRoles={['grower']}>
                <GrowerDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/grower/batches"
            element={
              <RequireAuth allowedRoles={['grower']}>
                <GrowerBatchesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/grower/batches/new"
            element={
              <RequireAuth allowedRoles={['grower']}>
                <GrowerBatchNewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/grower/logs"
            element={
              <RequireAuth allowedRoles={['grower']}>
                <GrowerLogsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/grower/logs/new"
            element={
              <RequireAuth allowedRoles={['grower']}>
                <GrowerLogNewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trace/:traceCode"
            element={
              <RequireAuth>
                <TraceDetailPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
