/** 链路事件的角色可见性过滤 */

import type { BatchEvent } from '../types/herb'
import type { UserRole } from '../types/auth'

/**
 * 事件按角色过滤：
 * - 管理员看到全部
 * - 其他角色：缺省 scopes 视为公开；否则按 `public` 或当前角色匹配
 */
export function filterEventsForRole(events: BatchEvent[], role: UserRole): BatchEvent[] {
  if (role === 'admin') return events
  return events.filter((e) => {
    if (!e.scopes || e.scopes.length === 0) return true
    return e.scopes.includes('public') || e.scopes.includes(role)
  })
}
