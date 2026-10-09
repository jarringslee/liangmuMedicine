import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/error.js'
import type { AuthUser } from './auth.js'
import { chatChanges } from './chatChanges.js'
import type { NotificationChanges } from './notificationChanges.js'

const contactSelect = {
  id: true, username: true, displayName: true, role: true,
  organization: { select: { name: true } },
} satisfies Prisma.UserSelect
type ContactRecord = Prisma.UserGetPayload<{ select: typeof contactSelect }>
export type ChatContact = Omit<ContactRecord, 'organization'> & { organizationName: string | null }
export type SendChatInput = { clientMessageId: string; content: string }

const contactDto = ({ organization, ...user }: ContactRecord): ChatContact =>
  ({ ...user, organizationName: organization?.name ?? null })
const messageSelect = { id: true, conversationId: true, senderId: true, sequence: true,
  clientMessageId: true, content: true, createdAt: true } satisfies Prisma.ChatMessageSelect
type MessageRecord = Prisma.ChatMessageGetPayload<{ select: typeof messageSelect }>
const messageDto = (item: MessageRecord) => ({ ...item, createdAt: item.createdAt.toISOString() })
const missing = () => new HttpError(404, 'CHAT_NOT_FOUND', '联系人或会话不存在，或当前无法访问')

/** 所有联系人查询共用此范围：真实账号/组织有效，采购商只可找平台客服。 */
export function chatContactWhere(actor: AuthUser): Prisma.UserWhereInput {
  const admin: Prisma.UserWhereInput = { role: 'admin', OR: [
    { organizationId: null }, { organization: { is: { type: 'platform', enabled: true } } },
  ] }
  const choices: Prisma.UserWhereInput[] = [admin]
  if (actor.role === 'admin') {
    for (const role of ['grower', 'processor', 'buyer'] as const) {
      choices.push({ role, organization: { is: { type: role, enabled: true } } })
    }
  } else if (actor.role !== 'buyer' && actor.organizationId) {
    choices.push({ role: actor.role, organizationId: actor.organizationId,
      organization: { is: { type: actor.role, enabled: true } } })
    choices.push(actor.role === 'grower'
      ? { role: 'processor', organization: { is: { type: 'processor', enabled: true,
        processedBatches: { some: { growerOrganizationId: actor.organizationId } } } } }
      : { role: 'grower', organization: { is: { type: 'grower', enabled: true,
        grownBatches: { some: { processorOrganizationId: actor.organizationId } } } } })
  }
  return { id: { not: actor.id }, status: 'active', OR: choices }
}

// 双向发起也会命中同一个唯一键；JSON 编码避免分隔符碰撞。
export const chatPairKey = (first: string, second: string) => JSON.stringify([first, second].sort())
function conversationWhere(actor: AuthUser): Prisma.ChatConversationWhereInput {
  return { AND: [
    { participants: { some: { userId: actor.id } } },
    { participants: { some: { user: { is: chatContactWhere(actor) } } } },
  ] }
}

export function createChatService(db: PrismaClient = prisma, changes: NotificationChanges = chatChanges) {
  const allowedConversation = (tx: Prisma.TransactionClient, actor: AuthUser, id: string) =>
    tx.chatConversation.findFirst({ where: { id, ...conversationWhere(actor) },
      include: { participants: { include: { user: { select: contactSelect } } } } })
  return {
    async contacts(actor: AuthUser, search: string) {
      const items = await db.user.findMany({ where: { AND: [chatContactWhere(actor),
        search ? { OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { organization: { is: { name: { contains: search, mode: 'insensitive' } } } },
        ] } : {}] }, select: contactSelect, orderBy: [{ displayName: 'asc' }, { id: 'asc' }], take: 31 })
      return { items: items.slice(0, 30).map(contactDto), hasMore: items.length > 30 }
    },
    async conversations(actor: AuthUser) {
      // MVP 限最近 100 个会话；联系人搜索仍可重新打开更早的同一个会话。
      const rows = await db.chatConversation.findMany({ where: conversationWhere(actor), take: 101,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], include: {
          participants: { include: { user: { select: contactSelect } } },
          messages: { orderBy: { sequence: 'desc' }, take: 1, select: messageSelect },
        } })
      const items = await Promise.all(rows.slice(0, 100).map(async (row) => {
        const self = row.participants.find((p) => p.userId === actor.id)!
        const peer = row.participants.find((p) => p.userId !== actor.id)!
        const unreadCount = await db.chatMessage.count({ where: { conversationId: row.id,
          senderId: { not: actor.id }, sequence: { gt: self.readSequence } } })
        return { id: row.id, contact: contactDto(peer.user), unreadCount,
          lastMessage: row.messages[0] ? messageDto(row.messages[0]) : null,
          updatedAt: row.updatedAt.toISOString() }
      }))
      return { items, hasMore: rows.length > 100 }
    },
    async open(actor: AuthUser, recipientId: string) {
      const contact = await db.user.findFirst({ where: { AND: [{ id: recipientId }, chatContactWhere(actor)] }, select: contactSelect })
      if (!contact) throw missing()
      const pairKey = chatPairKey(actor.id, recipientId)
      // 并发创建唯一键冲突后取已有会话，不新建重复私聊。
      let conversation
      try {
        conversation = await db.chatConversation.upsert({ where: { pairKey }, update: {}, create: {
          pairKey, participants: { create: [{ userId: actor.id }, { userId: recipientId }] },
        } })
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
        conversation = await db.chatConversation.findUniqueOrThrow({ where: { pairKey } })
      }
      changes.publish([actor.id, recipientId])
      return { id: conversation.id, contact: contactDto(contact) }
    },
    async history(actor: AuthUser, id: string, before?: number) {
      const row = await allowedConversation(db, actor, id)
      if (!row) throw missing()
      const records = await db.chatMessage.findMany({ where: { conversationId: id,
        ...(before === undefined ? {} : { sequence: { lt: before } }) },
        orderBy: { sequence: 'desc' }, take: 41, select: messageSelect })
      const items = records.slice(0, 40).reverse().map(messageDto)
      return { conversationId: id, contact: contactDto(row.participants.find((p) => p.userId !== actor.id)!.user),
        items, nextBefore: records.length > 40 ? items[0].sequence : null }
    },
    async send(actor: AuthUser, id: string, input: SendChatInput) {
      const write = () => db.$transaction(async (tx) => {
        const row = await allowedConversation(tx, actor, id)
        if (!row) throw missing()
        const existing = await tx.chatMessage.findUnique({ where: {
          senderId_clientMessageId: { senderId: actor.id, clientMessageId: input.clientMessageId },
        }, select: messageSelect })
        if (existing) {
          if (existing.conversationId !== id || existing.content !== input.content) {
            throw new HttpError(409, 'CHAT_REQUEST_CONFLICT', '相同消息编号不能发送不同内容')
          }
          return { item: existing, ids: row.participants.map((p) => p.userId) }
        }
        // UPDATE 获得行锁，原子递增；并发发送仍有明确的服务端顺序。
        const next = await tx.chatConversation.update({ where: { id }, data: { lastSequence: { increment: 1 } } })
        const item = await tx.chatMessage.create({ data: { ...input, conversationId: id, senderId: actor.id,
          sequence: next.lastSequence }, select: messageSelect })
        return { item, ids: row.participants.map((p) => p.userId) }
      })
      let saved
      try { saved = await write() }
      catch (error) {
        // 同 UUID 并发请求的失败事务回滚后，再检查已提交的那条记录。
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
        saved = await write()
      }
      changes.publish(saved.ids) // 先落库，后提示。Socket 不是消息存储。
      return { item: messageDto(saved.item) }
    },
    async markRead(actor: AuthUser, id: string, sequence: number) {
      await db.$transaction(async (tx) => {
        const row = await allowedConversation(tx, actor, id)
        if (!row) throw missing()
        if (sequence > row.lastSequence) throw new HttpError(400, 'INVALID_READ_CURSOR', '已读位置超过现有消息')
        // 多标签乱序上报也只能前进；不把尚未拉取的新消息标成已读。
        await tx.chatParticipant.updateMany({ where: { conversationId: id, userId: actor.id,
          readSequence: { lt: sequence } }, data: { readSequence: sequence } })
      })
      changes.publish([actor.id])
      return { conversationId: id }
    },
  }
}
export type ChatService = ReturnType<typeof createChatService>
