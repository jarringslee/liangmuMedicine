import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/dashboard'
import LoginPage from './pages/login'
import MessagesPage from './pages/messages'
import ProfilePage from './pages/profile'

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
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
