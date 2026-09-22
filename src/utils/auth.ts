import type { AuthSession, UserRole } from '../types/auth'

// 与旧版 Mock 登录隔离；API 模式绝不把本地用户资料当成服务端身份。
export const AUTH_STORAGE_KEY = 'liangmu_demo_auth_v2'
export const TOKEN_STORAGE_KEY = 'liangmu_api_token_v1'

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'grower' || value === 'processor' || value === 'buyer'
}

export function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || !isUserRole(value.role)) return null
    if (![value.userId, value.displayName, value.email, value.roleLabel].every((item) => typeof item === 'string')) return null
    const optionalFields = ['growerId', 'growerName', 'processorId', 'processorName', 'organizationId', 'organizationName']
    if (optionalFields.some((field) => value[field] !== undefined && typeof value[field] !== 'string')) return null
    return value as AuthSession
  } catch {
    return null
  }
}

export function getAuthSession(): AuthSession | null {
  try { return parseAuthSession(sessionStorage.getItem(AUTH_STORAGE_KEY)) } catch { return null }
}

export function setAuthSession(session: AuthSession): void {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession(): void {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
    sessionStorage.removeItem(TOKEN_STORAGE_KEY)
    sessionStorage.removeItem('liangmu_auth')
  } catch { /* 存储被浏览器禁用时仍允许清理内存登录态。 */ }
}

export function getAccessToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_STORAGE_KEY) } catch { return null }
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
}

/** 仅允许站内相对路径，防止 open redirect */
export function sanitizeRedirectPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null
  if (path.includes('\\') || [...path].some((char) => char.charCodeAt(0) <= 32)) return null
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase()
  if (pathname === '/login' || pathname === '') return null
  return path
}

export function getDefaultHome(role: UserRole): string {
  switch (role) {
    case 'buyer': return '/buyer/herbs'
    case 'grower': return '/grower/dashboard'
    case 'processor': return '/processor/dashboard'
    default: return '/dashboard'
  }
}
