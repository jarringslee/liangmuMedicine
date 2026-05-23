/** 消息通知 — 兼容入口，数据见 `inbox.ts` */

export type { InboxMessage as NotificationItem, MessageChannel } from './inbox'

export {
  getRecentInboxPreview,
  getUnreadMessageCount,
  inboxMessages,
  unreadMessageCount,
} from './inbox'

export { unreadMessageCount as unreadNotificationCount } from './inbox'
