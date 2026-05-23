import { Navigate, useLocation } from 'react-router-dom'
import type { UserRole } from '../types/auth'
import { getDefaultHome } from '../mock/user/credentials'
import { getAuthSession, sanitizeRedirectPath } from '../utils/auth'

type RequireAuthProps = {
  children: React.ReactNode
  /** 不传则任意已登录用户可访问 */
  allowedRoles?: UserRole[]
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const location = useLocation()
  const session = getAuthSession()

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to={getDefaultHome(session.role)} replace />
  }

  return children
}

type GuestOnlyProps = {
  children: React.ReactNode
}

/** 已登录用户访问登录页时跳转到首页或 redirect */
export function GuestOnly({ children }: GuestOnlyProps) {
  const session = getAuthSession()
  const params = new URLSearchParams(window.location.search)
  const redirect = sanitizeRedirectPath(params.get('redirect'))

  if (session) {
    return <Navigate to={redirect ?? getDefaultHome(session.role)} replace />
  }

  return children
}
