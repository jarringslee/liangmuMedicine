import type { BusinessNotification, NotificationPage } from '../types/notification'
import { ApiError } from './api'

const types = ['batchSubmitted', 'auditResult', 'stageChanged', 'qcReportUploaded', 'system']
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
function invalid(): never { throw new ApiError(0, 'INVALID_RESPONSE', '通知返回格式不正确') }

export function parseNotification(value: unknown): BusinessNotification {
  if (!record(value) || typeof value.id !== 'string' || !value.id
    || !types.includes(String(value.type)) || typeof value.title !== 'string' || typeof value.content !== 'string'
    || !(value.batchId === null || typeof value.batchId === 'string' && !!value.batchId)
    || !date(value.createdAt) || !(value.readAt === null || date(value.readAt))) return invalid()
  return {
    id: value.id, type: value.type as BusinessNotification['type'], title: value.title, content: value.content,
    batchId: value.batchId, createdAt: value.createdAt, readAt: value.readAt,
  }
}

export function parseNotificationPage(value: unknown): NotificationPage {
  if (!record(value) || !Array.isArray(value.items)
    || !integer(value.total) || !integer(value.unreadCount)
    || !integer(value.page) || value.page < 1 || !integer(value.pageSize) || value.pageSize < 1 || value.pageSize > 100
    || value.items.length > value.pageSize || value.total < value.items.length) return invalid()
  const items = value.items.map(parseNotification)
  if (new Set(items.map((item) => item.id)).size !== items.length) return invalid()
  return { items, total: value.total, unreadCount: value.unreadCount,
    page: value.page, pageSize: value.pageSize }
}

export function parseReadNotification(value: unknown, id: string): BusinessNotification {
  if (!record(value)) return invalid()
  const item = parseNotification(value.item)
  if (item.id !== id || item.readAt === null) return invalid()
  return item
}
