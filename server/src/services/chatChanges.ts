import { createNotificationChanges } from './notificationChanges.js'

// 复用提示总线的实现，但分开实例与事件名，不把聊天写进 Notification。
export const chatChanges = createNotificationChanges()
