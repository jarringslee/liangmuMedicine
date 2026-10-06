import { authMode } from '../config/api'
import type { NotificationQuery } from '../types/notification'
import { apiRequest } from './api'
import { parseNotificationPage, parseReadNotification } from './notificationContract'
import { listDemoNotifications, markDemoNotificationRead } from './notificationDemo'


// 获取通知列表
export async function listNotifications(query: NotificationQuery, signal?: AbortSignal) {
    signal?.throwIfAborted()

    // 页面不用判断模式，数据源统一选择 API 或本地演示。
    if (authMode === 'demo') return listDemoNotifications(query)

    const params = new URLSearchParams({
        page: String(query.page),
        pageSize: String(query.pageSize),
        status: query.status,
    })

    // 网络数据先按 unknown 接收，再做运行时检查。
    const result = await apiRequest<unknown>(`/notifications?${params}`, { signal })
    return parseNotificationPage(result)
}


// 标记已读
export async function markNotificationRead(id: string) {
    if (authMode === 'demo') return markDemoNotificationRead(id)

    const result = await apiRequest<unknown>(
        `/notifications/${encodeURIComponent(id)}/read`,
        { method: 'PATCH', body: {} },
    )

    return parseReadNotification(result, id)
}