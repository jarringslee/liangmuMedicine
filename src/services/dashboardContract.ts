import { AUDIT_LABEL, HERB_CATEGORY_LABEL, RISK_LABEL, STAGE_LABEL } from '../types/herb'
import type { AuditStatus, HerbCategory, RiskLevel, Stage } from '../types/herb'
import type { DashboardBatch, DashboardOverview } from '../types/dashboard'
import { ApiError } from './api'

function invalid(): never { throw new ApiError(0, 'INVALID_RESPONSE', '看板数据格式不正确，请重试') }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) return invalid()
  return value
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid()
  return value
}
function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) return invalid()
  if (new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10)) return invalid()
  return value
}
function enumValue<T extends string>(value: unknown, labels: Record<T, string>): T {
  if (typeof value !== 'string' || !Object.hasOwn(labels, value)) return invalid()
  return value as T
}
function rows(value: unknown, size: number, pending = false): DashboardBatch[] {
  if (!Array.isArray(value) || value.length !== size) return invalid()
  const seen = new Set<string>()
  return value.map((entry) => {
    const row = object(entry), id = text(row.id)
    if (seen.has(id)) return invalid()
    seen.add(id)
    const auditStatus = enumValue<AuditStatus>(row.auditStatus, AUDIT_LABEL)
    if (pending && auditStatus !== 'pending') return invalid()
    return { id, batchNo: text(row.batchNo), traceCode: text(row.traceCode), herbName: text(row.herbName),
      growerName: text(row.growerName), stage: enumValue<Stage>(row.stage, STAGE_LABEL), auditStatus,
      riskLevel: enumValue<RiskLevel>(row.riskLevel, RISK_LABEL), updatedAt: date(row.updatedAt) }
  })
}
function distribution<T extends string>(value: unknown, key: 'stage' | 'category', labels: Record<T, string>) {
  const keys = Object.keys(labels) as T[]
  if (!Array.isArray(value) || value.length !== keys.length) return invalid()
  const counts = new Map<T, number>()
  for (const entry of value) {
    const row = object(entry), name = enumValue<T>(row[key], labels)
    if (counts.has(name)) return invalid()
    counts.set(name, count(row.count))
  }
  return keys.map((name) => ({ name, count: counts.get(name)! }))
}

export function parseDashboardOverview(raw: unknown, mode: 'api' | 'demo'): DashboardOverview {
  const value = object(raw), summary = object(value.summary)
  if (value.mode !== mode) return invalid()
  const totalBatches = count(summary.totalBatches), pendingAuditBatches = count(summary.pendingAuditBatches)
  const riskBatches = count(summary.riskBatches), warehousingBatches = count(summary.warehousingBatches)
  if ([pendingAuditBatches, riskBatches, warehousingBatches].some((n) => n > totalBatches)) return invalid()
  const stageDistribution = distribution<Stage>(value.stageDistribution, 'stage', STAGE_LABEL).map(({ name, count }) => ({ stage: name, count }))
  const categoryDistribution = distribution<HerbCategory>(value.categoryDistribution, 'category', HERB_CATEGORY_LABEL).map(({ name, count }) => ({ category: name, count }))
  if (stageDistribution.reduce((n, r) => n + r.count, 0) !== totalBatches
    || categoryDistribution.reduce((n, r) => n + r.count, 0) !== totalBatches
    || stageDistribution.find((r) => r.stage === 'warehousing')!.count !== warehousingBatches) return invalid()
  return { mode, generatedAt: date(value.generatedAt), summary: { totalBatches, pendingAuditBatches, riskBatches, warehousingBatches },
    stageDistribution, categoryDistribution, recentBatches: rows(value.recentBatches, Math.min(totalBatches, 6)),
    pendingBatches: rows(value.pendingBatches, Math.min(pendingAuditBatches, 5), true) }
}
