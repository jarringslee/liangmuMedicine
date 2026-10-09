import type { ChatContact, ChatConversation, ChatHistory, ChatMessage, ChatTarget } from '../types/chat'
import { ApiError } from './api'

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0
const date = (v: unknown): v is string => text(v) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
function invalid(): never { throw new ApiError(0, 'INVALID_RESPONSE', '人工聊天返回格式不正确') }

export function parseChatContact(v: unknown): ChatContact {
  if (!record(v) || !text(v.id) || !text(v.username) || !text(v.displayName)
    || typeof v.role !== 'string' || !['admin', 'grower', 'processor', 'buyer'].includes(v.role)
    || !(v.organizationName === null || text(v.organizationName))) return invalid()
  return { id: v.id, username: v.username, displayName: v.displayName,
    role: v.role as ChatContact['role'], organizationName: v.organizationName }
}
export function parseChatMessage(v: unknown, conversationId?: string): ChatMessage {
  if (!record(v) || !text(v.id) || !text(v.conversationId) || !text(v.senderId) || !text(v.clientMessageId)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.clientMessageId)
    || !integer(v.sequence) || v.sequence < 1 || !text(v.content) || v.content.length > 2000 || !date(v.createdAt)
    || conversationId !== undefined && v.conversationId !== conversationId) return invalid()
  return { id: v.id, conversationId: v.conversationId, senderId: v.senderId, clientMessageId: v.clientMessageId,
    sequence: v.sequence, content: v.content, createdAt: v.createdAt }
}
export function parseChatContacts(v: unknown) {
  if (!record(v) || !Array.isArray(v.items) || v.items.length > 30 || typeof v.hasMore !== 'boolean') return invalid()
  const items = v.items.map(parseChatContact)
  if (new Set(items.map((i) => i.id)).size !== items.length) return invalid()
  return { items, hasMore: v.hasMore }
}
export function parseChatTarget(v: unknown): ChatTarget {
  if (!record(v) || !text(v.id)) return invalid()
  return { id: v.id, contact: parseChatContact(v.contact) }
}
export function parseChatConversations(v: unknown) {
  if (!record(v) || !Array.isArray(v.items) || v.items.length > 100 || typeof v.hasMore !== 'boolean') return invalid()
  const items: ChatConversation[] = v.items.map((row: unknown) => {
    if (!record(row) || !text(row.id) || !integer(row.unreadCount) || !date(row.updatedAt)) return invalid()
    return { ...parseChatTarget(row), unreadCount: row.unreadCount, updatedAt: row.updatedAt,
      lastMessage: row.lastMessage === null ? null : parseChatMessage(row.lastMessage, row.id) }
  })
  if (new Set(items.map((i) => i.id)).size !== items.length) return invalid()
  return { items, hasMore: v.hasMore }
}
export function parseChatHistory(v: unknown, conversationId: string): ChatHistory {
  if (!record(v) || v.conversationId !== conversationId || !Array.isArray(v.items) || v.items.length > 40
    || !(v.nextBefore === null || integer(v.nextBefore) && v.nextBefore > 0)) return invalid()
  const items = v.items.map((i: unknown) => parseChatMessage(i, conversationId))
  if (items.some((i, index) => index > 0 && i.sequence <= items[index - 1].sequence)
    || new Set(items.map((i) => i.id)).size !== items.length
    || v.nextBefore !== null && (!items.length || v.nextBefore !== items[0].sequence)) return invalid()
  return { conversationId, contact: parseChatContact(v.contact), items, nextBefore: v.nextBefore }
}
export function parseChatSent(v: unknown, id: string, requestId: string, content: string) {
  if (!record(v)) return invalid()
  const item = parseChatMessage(v.item, id)
  if (item.clientMessageId !== requestId || item.content !== content.trim()) return invalid()
  return item
}
export function parseChatRead(v: unknown, id: string) {
  if (!record(v) || v.conversationId !== id) return invalid()
  return { conversationId: id }
}
