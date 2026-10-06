/** 单进程提示总线：只在数据库提交后发布，不保存或代替数据库消息。 */
export function createNotificationChanges() {
  const listeners = new Set<(recipientIds: string[]) => void>()
  return {
    subscribe(listener: (recipientIds: string[]) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish(recipientIds: string[]) {
      for (const listener of listeners) {
        // 推送失败不能把已经提交的业务写入变成 HTTP 失败，断线后通过 REST 补查。
        try { listener([...new Set(recipientIds)]) }
        catch { console.warn('Notification hint delivery failed; REST remains available') }
      }
    },
  }
}

export const notificationChanges = createNotificationChanges()
export type NotificationChanges = ReturnType<typeof createNotificationChanges>
