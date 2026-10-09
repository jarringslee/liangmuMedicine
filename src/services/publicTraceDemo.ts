import type { HerbBatch } from '../types/herb'
import type { PublicTraceBatch } from '../types/publicTrace'
import { ApiError } from './api'
import { parsePublicTraceBatch } from './publicTraceContract'

// 旧 demo 时间没有时区；按项目业务时区解释，不能依赖运行电脑所在时区。
function chinaTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(value)) {
    const local = value.length === 10 ? `${value}T00:00:00` : value.replace(' ', 'T')
    value = `${local.length === 16 ? `${local}:00` : local}+08:00`
  } else if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new ApiError(0, 'INVALID_RESPONSE', '演示溯源时间格式不正确')
  }
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new ApiError(0, 'INVALID_RESPONSE', '演示溯源时间格式不正确')
  return new Date(timestamp).toISOString()
}

/** 仅是静态离线演示适配，不是安全隔离：静态 JSON 本身已经发送到浏览器。 */
export function buildDemoPublicTrace(batch: HerbBatch | null): PublicTraceBatch | null {
  if (!batch || batch.auditStatus !== 'approved') return null
  const events = batch.events.filter((event) =>
    ['create', 'stageChange', 'qcReport', 'storage', 'transport'].includes(event.type)
    && (!event.scopes?.length || event.scopes.includes('public')))
    .map((event) => ({
      type: event.type, occurredAt: chinaTime(event.occurredAt),
      ...(event.type === 'stageChange' && event.fromStage ? { fromStage: event.fromStage } : {}),
      ...(event.type === 'stageChange' && event.toStage ? { toStage: event.toStage } : {}),
    })).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
  return parsePublicTraceBatch({
    traceCode: batch.traceCode, batchNo: batch.batchNo, herbName: batch.herbName, category: batch.category,
    origin: { province: batch.origin.province, city: batch.origin.city, district: batch.origin.district },
    growerName: batch.growerName, plantingStartDate: batch.plantingStartDate,
    stage: batch.stage, auditStatus: batch.auditStatus, riskLevel: batch.riskLevel,
    createdAt: chinaTime(batch.createdAt), updatedAt: chinaTime(batch.updatedAt),
    events: events.slice(0, 100), eventsTruncated: events.length > 100,
  }, batch.traceCode)
}
