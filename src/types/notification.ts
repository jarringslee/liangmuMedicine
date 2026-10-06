export type NotificationStatus = 'all' | 'unread' | 'read'
export type NotificationQuery = { page: number; pageSize: number; status: NotificationStatus }
export type BusinessNotification = {
  id: string
  type: 'batchSubmitted' | 'auditResult' | 'stageChanged' | 'qcReportUploaded' | 'system'
  batchId: string | null
  title: string
  content: string
  createdAt: string
  readAt: string | null
}
export type NotificationPage = {
  items: BusinessNotification[]; total: number; unreadCount: number; page: number; pageSize: number
}
