import { authMode } from '../config/api'
import type { ApiUser, AuthSession, LoginInput } from '../types/auth'
import { getAccessToken, getAuthSession, isUserRole, setAccessToken, setAuthSession, clearAuthSession } from '../utils/auth'
import { ApiError, apiRequest, isAbortError, setAuthFailureHandler } from './api'
import { queryClient } from './queryClient'

type AuthState = {
  status: 'checking' | 'authenticated' | 'anonymous' | 'error'
  session: AuthSession | null
  message: string | null
}
let state: AuthState = { status: 'checking', session: null, message: null }
const listeners = new Set<() => void>()
let revision = 0
let activeRequest: AbortController | null = null
let restorePromise: Promise<void> | null = null
let expiryTimer: ReturnType<typeof setTimeout> | undefined

export const getAuthSnapshot = () => state
export function subscribeAuth(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
function publish(next: AuthState) {
  state = next
  listeners.forEach((listener) => listener())
}
function cancelAuthWork() {
  revision++
  activeRequest?.abort()
  activeRequest = null
  restorePromise = null
  clearTimeout(expiryTimer)
}
function clearUserCache() {
  void queryClient.cancelQueries()
  queryClient.clear()
}

export function logout(message: string | null = null) {
  cancelAuthWork()
  clearAuthSession()
  clearUserCache()
  publish({ status: 'anonymous', session: null, message })
}
setAuthFailureHandler((message) => logout(message))

/** Token 的 exp 只用于前端定时退出；是否可信仍由服务端验签和 /me 决定。 */
function scheduleExpiry(token: string) {
  clearTimeout(expiryTimer)
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof payload.exp === 'number') {
      expiryTimer = setTimeout(() => {
        if (getAccessToken() === token) logout('登录已过期，请重新登录')
      }, Math.max(0, Math.min(payload.exp * 1000 - Date.now(), 2_147_483_647)))
    }
  } catch { /* 不把本地解码结果当作认证依据，异常 Token 由 /me 拒绝。 */ }
}

function toSession(value: unknown): AuthSession {
  if (!value || typeof value !== 'object') throw new ApiError(0, 'INVALID_RESPONSE', '用户资料格式不正确')
  const user = value as ApiUser
  if (!isUserRole(user.role) || ![user.id, user.username, user.email, user.displayName].every((field) => typeof field === 'string')) {
    throw new ApiError(0, 'INVALID_RESPONSE', '用户资料格式不正确')
  }
  const organization = user.organization
  if (user.organizationId !== null && typeof user.organizationId !== 'string' ||
    organization !== null && (!organization || typeof organization.id !== 'string' || typeof organization.name !== 'string' || organization.id !== user.organizationId) ||
    organization === null && user.organizationId !== null) {
    throw new ApiError(0, 'INVALID_RESPONSE', '组织资料格式不正确')
  }
  const labels = { admin: '管理员', grower: '种植商', processor: '加工商', buyer: '采购商' }
  return {
    userId: user.id, role: user.role, displayName: user.displayName, email: user.email, roleLabel: labels[user.role],
    ...(organization ? { organizationId: organization.id, organizationName: organization.name } : {}),
    ...(user.role === 'grower' && organization ? { growerId: organization.id, growerName: organization.name } : {}),
    ...(user.role === 'processor' && organization ? { processorId: organization.id, processorName: organization.name } : {}),
  }
}

/** 首次挂载只请求一次；StrictMode 重跑 effect 时复用 Promise。网络错误保留 Token，允许重试。 */
export function restoreAuth(): Promise<void> {
  if (restorePromise) return restorePromise
  if (state.status === 'authenticated' || state.status === 'anonymous') return Promise.resolve()
  if (authMode === 'demo') {
    const session = getAuthSession()
    publish({ status: session ? 'authenticated' : 'anonymous', session, message: null })
    return Promise.resolve()
  }
  const token = getAccessToken()
  if (!token) {
    publish({ status: 'anonymous', session: null, message: null })
    return Promise.resolve()
  }
  const attempt = ++revision
  const controller = new AbortController()
  activeRequest = controller
  publish({ status: 'checking', session: null, message: null })
  restorePromise = (async () => {
    try {
      const response = await apiRequest<{ user: unknown }>('/auth/me', { signal: controller.signal })
      if (revision !== attempt) return
      const session = toSession(response.user)
      clearUserCache()
      publish({ status: 'authenticated', session, message: null })
      scheduleExpiry(token)
    } catch (error) {
      if (revision !== attempt || isAbortError(error)) return
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) logout(error.message)
      else publish({ status: 'error', session: null, message: error instanceof Error ? error.message : '登录状态验证失败' })
    } finally {
      if (revision === attempt) { restorePromise = null; activeRequest = null }
    }
  })()
  return restorePromise
}

export async function login(input: LoginInput): Promise<AuthSession> {
  cancelAuthWork()
  const attempt = revision
  const controller = new AbortController()
  activeRequest = controller
  try {
    let session: AuthSession
    let token: string | null = null
    if (authMode === 'demo') {
      const { verifyStaticLogin } = await import('../mock/user/credentials')
      const result = verifyStaticLogin(input.role, input.account.includes('@') ? 'email' : 'username', input.account, input.password)
      if (!result) throw new ApiError(401, 'INVALID_CREDENTIALS', '账号、密码或所选角色不正确')
      session = result
    } else {
      const response = await apiRequest<{ accessToken: string; user: unknown }>('/auth/login', {
        method: 'POST', body: input, auth: false, signal: controller.signal,
      })
      if (typeof response.accessToken !== 'string' || !response.accessToken) throw new ApiError(0, 'INVALID_RESPONSE', '登录响应格式不正确')
      session = toSession(response.user)
      token = response.accessToken
    }
    if (revision !== attempt) throw new DOMException('登录请求已取消', 'AbortError')
    try {
      clearAuthSession()
      if (token) setAccessToken(token)
      else setAuthSession(session)
    } catch {
      throw new ApiError(0, 'STORAGE_UNAVAILABLE', '浏览器禁止保存登录状态，请允许本站存储后重试')
    }
    clearUserCache()
    publish({ status: 'authenticated', session, message: null })
    if (token) scheduleExpiry(token)
    return session
  } finally {
    if (revision === attempt) activeRequest = null
  }
}
