import { apiBaseUrl, authMode } from '../config/api'
import { getAccessToken } from '../utils/auth'

export class ApiError extends Error {
  status: number
  code: string
  retryAfter: string | null
  constructor(status: number, code: string, message: string, retryAfter: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  auth?: boolean
}

// 由登录状态模块注册，避免请求层依赖 React、路由或弹窗。
let onAuthFailure: (message: string) => void = () => undefined
export function setAuthFailureHandler(handler: typeof onAuthFailure) { onAuthFailure = handler }

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/** 所有业务 API 共用：JSON、Bearer、超时、取消、错误格式和过期凭证处理。 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API path 必须为相对接口路径')
  const authenticated = options.auth !== false && authMode === 'api'
  const token = authenticated ? getAccessToken() : null
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), 15_000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    })
    const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    signal.throwIfAborted()
    // A 账号发出的请求不能在切到 B 后写入 B 的页面，旧 401 也不能踢掉 B。
    if (authenticated && token !== getAccessToken()) throw new DOMException('登录身份已变化', 'AbortError')
    if (!response.ok) {
      const errorBody = body && typeof body === 'object' && 'error' in body ? body.error : null
      const code = errorBody && typeof errorBody === 'object' && 'code' in errorBody && typeof errorBody.code === 'string'
        ? errorBody.code : `HTTP_${response.status}`
      const message = errorBody && typeof errorBody === 'object' && 'message' in errorBody && typeof errorBody.message === 'string'
        ? errorBody.message : response.status === 403 ? '没有执行此操作的权限' : '服务暂时不可用，请稍后重试'
      const error = new ApiError(response.status, code, message, response.headers.get('Retry-After'))
      const accountBlocked = response.status === 403 && ['ACCOUNT_DISABLED', 'ORGANIZATION_DISABLED', 'INVALID_ORGANIZATION'].includes(code)
      if (authenticated && token && (response.status === 401 || accountBlocked)) onAuthFailure(message)
      throw error
    }
    if (body === undefined && response.status !== 204) throw new ApiError(0, 'INVALID_RESPONSE', '服务返回格式不正确')
    return body as T
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error) && !timeout.signal.aborted) throw error
    if (timeout.signal.aborted) throw new ApiError(0, 'TIMEOUT', '请求超时，请重试')
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务，请检查网络后重试')
  } finally {
    clearTimeout(timer)
  }
}
