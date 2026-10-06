import type { AuditStatus, HerbCategory, RiskLevel, Stage } from './herb'

export type DashboardBatch = {
  id: string
  batchNo: string
  traceCode: string
  herbName: string
  growerName: string
  stage: Stage
  auditStatus: AuditStatus
  riskLevel: RiskLevel
  updatedAt: string
}

export type DashboardOverview = {
  mode: 'api' | 'demo'
  generatedAt: string
  summary: {
    totalBatches: number
    pendingAuditBatches: number
    riskBatches: number
    warehousingBatches: number
  }
  stageDistribution: { stage: Stage; count: number }[]
  categoryDistribution: { category: HerbCategory; count: number }[]
  recentBatches: DashboardBatch[]
  pendingBatches: DashboardBatch[]
}
