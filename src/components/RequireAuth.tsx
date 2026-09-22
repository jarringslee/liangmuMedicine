import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button, Result } from 'antd'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types/auth'
import { getDefaultHome, sanitizeRedirectPath } from '../utils/auth'

type RequireAuthProps = {
  children: React.ReactNode
  /** 不传则任意已登录用户可访问 */
  allowedRoles?: UserRole[]
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const location = useLocation()
  const { session } = useAuth()

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Result status="403" title="没有访问权限" subTitle="当前账号无权访问此页面。"
      extra={<Link to={getDefaultHome(session.role)}><Button type="primary">返回工作台</Button></Link>} />
  }

  return children
}

type GuestOnlyProps = {
  children: React.ReactNode
}

/** 已登录用户访问登录页时跳转到首页或 redirect */
export function GuestOnly({ children }: GuestOnlyProps) {
  const { session } = useAuth()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const redirect = sanitizeRedirectPath(params.get('redirect'))

  if (session) {
    return <Navigate to={redirect ?? getDefaultHome(session.role)} replace />
  }

  return children
}
