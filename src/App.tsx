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
import GrowerHarvestListPage from './pages/grower/harvest'
import GrowerHarvestNewPage from './pages/grower/harvest/new'
import ProcessorDashboardPage from './pages/processor/dashboard'
import ProcessorBatchesPage from './pages/processor/batches'
import TraceDetailPage from './pages/trace/Detail'
import { useHerbStoreInvalidator } from './hooks/useHerbBatches'

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
        <HerbSyncBridge />
      </BrowserRouter>
    </ConfigProvider>
  )
}

/**
 * 全局事件 → TanStack Query 缓存失效的桥接
 * 监听 storage 派发的 `herb-changed` 事件，触发
 * queryClient.invalidateQueries(['herb-batches'])，
 * 所有订阅 useHerbBatches / useHerbBatchById 的页面自动重新拉取。
 */
function HerbSyncBridge() {
  useHerbStoreInvalidator()
  return (
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
        path="/grower/harvest"
        element={
          <RequireAuth allowedRoles={['grower']}>
            <GrowerHarvestListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/grower/harvest/new"
        element={
          <RequireAuth allowedRoles={['grower']}>
            <GrowerHarvestNewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/processor/dashboard"
        element={
          <RequireAuth allowedRoles={['processor']}>
            <ProcessorDashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/processor/batches"
        element={
          <RequireAuth allowedRoles={['processor']}>
            <ProcessorBatchesPage />
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
  )
}
