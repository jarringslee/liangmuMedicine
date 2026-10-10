import { lazy, Suspense } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { GuestOnly, RequireAuth } from './components/RequireAuth'
import { AuthBoundary } from './components/AuthBoundary'
import PageLoading from './components/PageLoading'
import PageErrorBoundary from './components/PageErrorBoundary'
import { useAuth } from './hooks/useAuth'
import { useHerbQueryInvalidator } from './hooks/useHerbBatches'

import { useNotificationRealtime } from './hooks/useNotifications'

import AssistantProvider from './components/assistant/AssistantProvider'

// lazy 的 loader 在页面真正渲染时才执行；角色守卫先决定是否允许渲染。
const Dashboard = lazy(() => import('./pages/dashboard'))
const LoginPage = lazy(() => import('./pages/login'))
const MessagesPage = lazy(() => import('./pages/messages'))
const ChatPage = lazy(() => import('./pages/chat'))
const ProfilePage = lazy(() => import('./pages/profile'))
const AdminHerbsPage = lazy(() => import('./pages/admin/herbs'))
const AdminHerbNewPage = lazy(() => import('./pages/admin/herbs/new'))
const BuyerHerbsPage = lazy(() => import('./pages/buyer/herbs'))
const GrowerDashboardPage = lazy(() => import('./pages/grower/dashboard'))
const GrowerBatchesPage = lazy(() => import('./pages/grower/batches'))
const GrowerBatchNewPage = lazy(() => import('./pages/grower/batches/new'))
const GrowerLogsPage = lazy(() => import('./pages/grower/logs'))
const GrowerLogNewPage = lazy(() => import('./pages/grower/logs/new'))
const GrowerHarvestListPage = lazy(() => import('./pages/grower/harvest'))
const GrowerHarvestNewPage = lazy(() => import('./pages/grower/harvest/new'))
const ProcessorDashboardPage = lazy(() => import('./pages/processor/dashboard'))
const ProcessorBatchesPage = lazy(() => import('./pages/processor/batches'))
const TraceDetailPage = lazy(() => import('./pages/trace/Detail'))

const PublicTracePage = lazy(() => import('./pages/trace/Public'))

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
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route
              path="/public/trace/:traceCode"
              element={<PublicTraceRoute />}
            />
            <Route
              path="*"
              element={
                <AuthBoundary>
                  <AssistantProvider>
                    <HerbSyncBridge />
                  </AssistantProvider>
                </AuthBoundary>
              }
            />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

/**
 * 公开页不进入登录恢复、AI 会话和认证实时订阅。
 * 路径变化时重建页面，重置输入状态与错误边界。
 */
function PublicTraceRoute() {
  const location = useLocation()

  return (
    <PageErrorBoundary
      key={`${location.pathname}${location.search}`}
    >
      <Suspense fallback={<PageLoading />}>
        <PublicTracePage />
      </Suspense>
    </PageErrorBoundary>
  )
}

/**
 * 全局事件 → TanStack Query 缓存失效的桥接
 * 监听 storage 派发的 `herb-changed` 事件，触发
 * queryClient.invalidateQueries(['herb-batches'])，
 * 所有订阅 useHerbBatches / useHerbBatchById 的页面自动重新拉取。
 * 同时挂载通知与人工聊天的共享实时订阅；此处统一创建/清理连接。
 */
function HerbSyncBridge() {
  useHerbQueryInvalidator()
  useNotificationRealtime()
  const location = useLocation()
  const { session } = useAuth()
  return (
    // 路由/账号变化重建边界；AI 会话和实时桥接在边界外，不随懒加载卸载。
    <PageErrorBoundary key={`${session?.userId ?? 'guest'}:${location.pathname}${location.search}`}>
      <Suspense fallback={<PageLoading />}>
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
              <RequireAuth>
                <MessagesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/chat"
            element={<RequireAuth><ChatPage /></RequireAuth>}
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
      </Suspense>
    </PageErrorBoundary>
  )
}
