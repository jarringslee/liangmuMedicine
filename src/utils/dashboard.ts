import { HERB_CATEGORY_LABEL, STAGE_LABEL, type HerbBatch, type HerbCategory, type Stage } from '../types/herb'
import type { DashboardBatch, DashboardOverview } from '../types/dashboard'

export function formatDashboardTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

// 旧 demo 的无时区时间按业务时区解释；不能随当前电脑时区改变排序。
function demoTimestamp(value: string) {
  const explicit = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  const local = value.replace(' ', 'T')
  return new Date(explicit ? value : `${local}${local.length === 10 ? 'T00:00:00' : ''}+08:00`).toISOString()
}

// 只从既有离线批次推导同口径统计，没有固定交易额、目标或 AI 假摘要。
export function buildDemoDashboardOverview(batches: HerbBatch[], now = new Date()): DashboardOverview {
  const rows: DashboardBatch[] = batches.map((batch) => ({
    id: batch.id, batchNo: batch.batchNo, traceCode: batch.traceCode, herbName: batch.herbName,
    growerName: batch.growerName, stage: batch.stage, auditStatus: batch.auditStatus,
    riskLevel: batch.riskLevel, updatedAt: demoTimestamp(batch.updatedAt),
  })).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id))
  return {
    mode: 'demo', generatedAt: now.toISOString(),
    summary: { totalBatches: rows.length, pendingAuditBatches: rows.filter((r) => r.auditStatus === 'pending').length,
      riskBatches: rows.filter((r) => r.riskLevel !== 'normal').length, warehousingBatches: rows.filter((r) => r.stage === 'warehousing').length },
    stageDistribution: (Object.keys(STAGE_LABEL) as Stage[]).map((stage) => ({ stage, count: rows.filter((r) => r.stage === stage).length })),
    categoryDistribution: (Object.keys(HERB_CATEGORY_LABEL) as HerbCategory[]).map((category) => ({ category, count: batches.filter((r) => r.category === category).length })),
    recentBatches: rows.slice(0, 6), pendingBatches: rows.filter((r) => r.auditStatus === 'pending').slice(0, 5),
  }
}
