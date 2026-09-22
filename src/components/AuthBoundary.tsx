import { useEffect } from 'react'
import { Button, Result, Space, Spin } from 'antd'
import { useAuth } from '../hooks/useAuth'

/** 只在应用入口恢复一次，验证完成前不挂载受保护页面和它们的数据查询。 */
export function AuthBoundary({ children }: { children: React.ReactNode }) {
  const { status, message, restoreAuth, logout } = useAuth()
  useEffect(() => { void restoreAuth() }, [restoreAuth])

  if (status === 'checking') {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <Space orientation="vertical" align="center"><Spin size="large" /><span>正在验证登录状态…</span></Space>
    </div>
  }
  if (status === 'error') {
    return <Result status="warning" title="暂时无法验证登录状态" subTitle={message}
      extra={<Space>
        <Button type="primary" onClick={() => void restoreAuth()}>重试</Button>
        <Button onClick={() => logout()}>返回登录</Button>
      </Space>} />
  }
  return children
}
