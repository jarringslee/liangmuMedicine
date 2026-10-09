import type { UserRole } from './auth'

export type ChatContact = { id: string; username: string; displayName: string;
  role: UserRole; organizationName: string | null }
export type ChatMessage = { id: string; conversationId: string; senderId: string;
  clientMessageId: string; sequence: number; content: string; createdAt: string }
export type ChatConversation = { id: string; contact: ChatContact; unreadCount: number;
  lastMessage: ChatMessage | null; updatedAt: string }
export type ChatHistory = { conversationId: string; contact: ChatContact; items: ChatMessage[];
  nextBefore: number | null }
export type ChatTarget = { id: string; contact: ChatContact }
export type SendChatInput = { clientMessageId: string; content: string }
export const chatRoleLabels: Record<UserRole, string> = {
  admin: '平台客服 / 管理员', grower: '种植商', processor: '加工商', buyer: '采购商',
}
