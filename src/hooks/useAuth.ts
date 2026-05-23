import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { AuthSession } from '../types/auth'
import { AUTH_STORAGE_KEY, clearAuthSession, parseAuthSession, setAuthSession } from '../utils/auth'

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener('auth-changed', onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener('auth-changed', onStoreChange)
  }
}

function getSnapshot(): string | null {
  return sessionStorage.getItem(AUTH_STORAGE_KEY)
}

function notifyAuthChanged() {
  window.dispatchEvent(new Event('auth-changed'))
}

export function useAuth() {
  /** 必须用稳定快照（原始字符串），不能每次 parse 出新对象，否则会无限重渲染 */
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null)

  const session = useMemo(() => parseAuthSession(raw), [raw])

  const login = useCallback((next: AuthSession) => {
    setAuthSession(next)
    notifyAuthChanged()
  }, [])

  const logout = useCallback(() => {
    clearAuthSession()
    notifyAuthChanged()
  }, [])

  return useMemo(
    () => ({
      session,
      isAuthenticated: session !== null,
      login,
      logout,
    }),
    [session, login, logout],
  )
}
