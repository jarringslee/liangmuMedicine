import type { AuthSession } from '../types/auth'

export const AUTH_STORAGE_KEY = 'liangmu_auth'

export function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function getAuthSession(): AuthSession | null {
  return parseAuthSession(sessionStorage.getItem(AUTH_STORAGE_KEY))
}

export function setAuthSession(session: AuthSession): void {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
}

export function isAuthenticated(): boolean {
  return getAuthSession() !== null
}

/** 仅允许站内相对路径，防止 open redirect */
export function sanitizeRedirectPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null
  if (path === '/login' || path === '/') return null
  return path
}
