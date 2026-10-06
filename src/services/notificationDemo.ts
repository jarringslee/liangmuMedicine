import { listInboxMessages, subscribeInboxChanged } from '../mock/message/inbox'
import type { BusinessNotification, NotificationPage, NotificationQuery } from '../types/notification'
import { ApiError } from './api'

const READ_KEY = 'liangmu_demo_notification_read_v1'
const CHANGE = 'liangmu-demo-notification-read'
function readTimes(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).filter((entry) => typeof entry[1] === 'string' && Number.isFinite(Date.parse(entry[1]))))
  } catch { return {} }
}
function items(): BusinessNotification[] {
  const times = readTimes()
  // 原模拟邮件/聊天不计入真实业务通知，避免把静态内容误称聊天室。
  return listInboxMessages().filter((item) => item.channel === 'system').map((item) => {
    const parsed = new Date(`${item.dateLabel.replace(' ', 'T')}:00+08:00`)
    const createdAt = Number.isFinite(parsed.getTime()) ? parsed.toISOString() : '2026-05-24T00:00:00.000Z'
    return { id: item.id, type: 'system', batchId: null, title: item.senderName, content: item.preview,
      createdAt, readAt: (Object.hasOwn(times, item.id) ? times[item.id] : undefined) ?? (item.read ? createdAt : null) }
  })
}
export function listDemoNotifications(query: NotificationQuery): NotificationPage {
  const all = items()
  const filtered = all.filter((item) => query.status === 'all' || (query.status === 'read') === (item.readAt !== null))
  return { items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: filtered.length,
    unreadCount: all.filter((item) => item.readAt === null).length, page: query.page, pageSize: query.pageSize }
}
export function markDemoNotificationRead(id: string): BusinessNotification {
  const item = items().find((item) => item.id === id)
  if (!item) throw new ApiError(404, 'NOT_FOUND', '通知不存在')
  if (!item.readAt) {
    item.readAt = new Date().toISOString()
    localStorage.setItem(READ_KEY, JSON.stringify({ ...readTimes(), [id]: item.readAt }))
    window.dispatchEvent(new Event(CHANGE))
  }
  return item
}
export function subscribeDemoNotifications(listener: () => void) {
  const unsubscribe = subscribeInboxChanged(listener)
  const storage = (event: StorageEvent) => { if (event.key === READ_KEY || event.key === null) listener() }
  window.addEventListener(CHANGE, listener)
  window.addEventListener('storage', storage)
  return () => { unsubscribe(); window.removeEventListener(CHANGE, listener); window.removeEventListener('storage', storage) }
}
