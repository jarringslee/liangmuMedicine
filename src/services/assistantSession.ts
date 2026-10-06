import type { AuthSession } from '../types/auth'
import { authMode } from '../config/api'
import { getAuthSnapshot } from './auth'

// 同账号重新登录也必须是新的会话。WeakMap 不存 Token，旧身份对象释放后可被回收。
const keys = new WeakMap<AuthSession, number>()
let sequence = 0
export function assistantSessionKey(session: AuthSession): string {
  if (!keys.has(session)) keys.set(session, ++sequence)
  return `${authMode}:${session.userId}:${keys.get(session)}`
}

export function isCurrentAssistantSession(session: AuthSession): boolean {
  const current = getAuthSnapshot()
  return current.status === 'authenticated' && current.session === session
}
