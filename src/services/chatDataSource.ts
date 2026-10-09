import { authMode } from '../config/api'
import type { SendChatInput } from '../types/chat'
import { ApiError, apiRequest } from './api'
import { parseChatContacts, parseChatConversations, parseChatHistory,
  parseChatRead, parseChatSent, parseChatTarget } from './chatContract'

// 静态 demo 不伪造人工聊天，也不让模拟身份连入真实聊天室。
function requireApi() {
  if (authMode !== 'api') throw new ApiError(0, 'CHAT_API_REQUIRED', '人工聊天需要真实 API 登录')
}
const path = (id: string) => `/chat/conversations/${encodeURIComponent(id)}`
export async function listChatContacts(search: string, signal?: AbortSignal) {
  requireApi()
  return parseChatContacts(await apiRequest<unknown>(`/chat/contacts?${new URLSearchParams({ search })}`, { signal }))
}
export async function listChatConversations(signal?: AbortSignal) {
  requireApi()
  return parseChatConversations(await apiRequest<unknown>('/chat/conversations', { signal }))
}
export async function openChat(recipientId: string) {
  requireApi()
  const target = parseChatTarget(await apiRequest<unknown>('/chat/conversations', { method: 'POST', body: { recipientId } }))
  if (target.contact.id !== recipientId) throw new ApiError(0, 'INVALID_RESPONSE', '会话联系人不匹配')
  return target
}
export async function listChatHistory(id: string, before: number | undefined, signal?: AbortSignal) {
  requireApi()
  const query = before === undefined ? '' : `?before=${before}`
  return parseChatHistory(await apiRequest<unknown>(`${path(id)}/messages${query}`, { signal }), id)
}
export async function sendChat(id: string, input: SendChatInput) {
  requireApi()
  return parseChatSent(await apiRequest<unknown>(`${path(id)}/messages`, { method: 'POST', body: input }),
    id, input.clientMessageId, input.content)
}
export async function readChat(id: string, sequence: number) {
  requireApi()
  return parseChatRead(await apiRequest<unknown>(`${path(id)}/read`, { method: 'PATCH', body: { sequence } }), id)
}
