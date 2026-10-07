import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/error.js'
import type { AuthUser } from './auth.js'
import { notificationChanges, type NotificationChanges } from './notificationChanges.js'

const notificationSelect = {
  id: true, type: true, batchId: true, title: true, content: true, readAt: true, createdAt: true,
} satisfies Prisma.NotificationSelect
export type NotificationRecord = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>
export type NotificationQuery = { page: number; pageSize: number; status: 'all' | 'unread' | 'read' }

export interface NotificationRepository {
  list(recipientId: string, query: NotificationQuery): Promise<{
    items: NotificationRecord[]; total: number; unreadCount: number
  }>
  markRead(recipientId: string, id: string): Promise<NotificationRecord | null>
}

const repository: NotificationRepository = {
  async list(recipientId, query) {
    const where: Prisma.NotificationWhereInput = {
      recipientId,
      ...(query.status === 'unread' ? { readAt: null } : {}),
      ...(query.status === 'read' ? { readAt: { not: null } } : {}),
    }
    const [items, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({ where, select: notificationSelect,
        skip: (query.page - 1) * query.pageSize, take: query.pageSize,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { recipientId, readAt: null } }),
    ], { isolationLevel: 'RepeatableRead' })
    return { items, total, unreadCount }
  },
  async markRead(recipientId, id) {
    return prisma.$transaction(async (tx) => {
      // 条件更新保证重复/并发点击不会改变首次已读时间。
      await tx.notification.updateMany({ where: { id, recipientId, readAt: null }, data: { readAt: new Date() } })
      return tx.notification.findFirst({ where: { id, recipientId }, select: notificationSelect })
    })
  },
}

export function createNotificationService(
  messages: NotificationRepository = repository,
  changes: NotificationChanges = notificationChanges,
) {
  return {
    async list(user: AuthUser, query: NotificationQuery) {
      return { ...await messages.list(user.id, query), page: query.page, pageSize: query.pageSize }
    },
    async markRead(user: AuthUser, id: string) {
      const item = await messages.markRead(user.id, id)
      if (!item) throw new HttpError(404, 'NOT_FOUND', '通知不存在')
      changes.publish([user.id])
      return item
    },
  }
}
export type NotificationService = ReturnType<typeof createNotificationService>
