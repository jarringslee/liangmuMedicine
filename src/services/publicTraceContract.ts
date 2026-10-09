import type { HerbCategory, RiskLevel, Stage } from '../types/herb'
import type { PublicTraceBatch } from '../types/publicTrace'
import { isTraceCode } from '../utils/traceCode'
import { ApiError } from './api'

const stages: Stage[] = ['planting', 'harvested', 'processing', 'warehousing', 'shipped', 'sold']
const categories: HerbCategory[] = ['root', 'wholeHerb', 'fruitSeed', 'flowerLeaf', 'bark', 'mineral', 'other']
const risks: RiskLevel[] = ['normal', 'low', 'medium', 'high']
const eventTypes = ['create', 'stageChange', 'qcReport', 'storage', 'transport'] as const
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 200
const date = (v: unknown): v is string => typeof v === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
  && Number.isFinite(Date.parse(v))
function invalid(): never { throw new ApiError(0, 'INVALID_RESPONSE', '公开溯源返回格式不正确') }
function member<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return invalid()
  return value as T
}
function plantingDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid()
  const timestamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return invalid()
  return value
}

/** unknown 必须在运行时检查；显式重建白名单，不把意外的私有字段传给页面。 */
export function parsePublicTraceBatch(v: unknown, traceCode: string): PublicTraceBatch {
  if (!record(v) || v.traceCode !== traceCode || !isTraceCode(traceCode)
    || !text(v.batchNo) || !text(v.herbName) || !text(v.growerName) || v.auditStatus !== 'approved'
    || !record(v.origin) || !text(v.origin.province) || !text(v.origin.city)
    || !(v.origin.district === undefined || text(v.origin.district))
    || !(v.processorName === undefined || text(v.processorName))
    || !date(v.createdAt) || !date(v.updatedAt) || !Array.isArray(v.events) || v.events.length > 100
    || typeof v.eventsTruncated !== 'boolean') return invalid()
  const events = v.events.map((event: unknown) => {
    if (!record(event) || !date(event.occurredAt)) return invalid()
    const type = member(event.type, eventTypes)
    if (type !== 'stageChange' && (event.fromStage !== undefined || event.toStage !== undefined)) return invalid()
    return {
      type, occurredAt: event.occurredAt,
      ...(event.fromStage !== undefined ? { fromStage: member(event.fromStage, stages) } : {}),
      ...(event.toStage !== undefined ? { toStage: member(event.toStage, stages) } : {}),
    }
  })
  if (events.some((event, index) => index > 0 && Date.parse(event.occurredAt) > Date.parse(events[index - 1].occurredAt))) return invalid()
  return {
    traceCode, batchNo: v.batchNo, herbName: v.herbName,
    category: member(v.category, categories),
    origin: { province: v.origin.province, city: v.origin.city,
      ...(v.origin.district !== undefined ? { district: v.origin.district } : {}) },
    growerName: v.growerName, ...(v.processorName !== undefined ? { processorName: v.processorName } : {}),
    plantingStartDate: plantingDate(v.plantingStartDate),
    stage: member(v.stage, stages), auditStatus: 'approved' as const, riskLevel: member(v.riskLevel, risks),
    createdAt: v.createdAt, updatedAt: v.updatedAt, events, eventsTruncated: v.eventsTruncated,
  }
}

export function parsePublicTraceReply(v: unknown, traceCode: string): PublicTraceBatch {
  if (!record(v)) return invalid()
  return parsePublicTraceBatch(v.batch, traceCode)
}
