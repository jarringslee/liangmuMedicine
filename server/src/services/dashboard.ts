import type { AuditStatus, BatchStage, HerbCategory, Prisma, PrismaClient, RiskLevel } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/error.js'
import type { AuthUser } from './auth.js'

const stages: BatchStage[] = ['planting', 'harvested', 'processing', 'warehousing', 'shipped', 'sold']
const categories: HerbCategory[] = ['root', 'wholeHerb', 'fruitSeed', 'flowerLeaf', 'bark', 'mineral', 'other']
const recentSelect = {
  id: true, batchNo: true, traceCode: true, herbName: true, stage: true,
  auditStatus: true, riskLevel: true, updatedAt: true,
  growerOrganization: { select: { name: true } },
} satisfies Prisma.HerbBatchSelect

type DashboardRow = Prisma.HerbBatchGetPayload<{ select: typeof recentSelect }>
type CountGroup = { stage: BatchStage; category: HerbCategory; auditStatus: AuditStatus; riskLevel: RiskLevel; count: number }
export type DashboardSnapshot = { groups: CountGroup[]; recent: DashboardRow[]; pending: DashboardRow[] }
export type DashboardRepository = { read: () => Promise<DashboardSnapshot> }

// 三次只读查询使用同一快照：统计卡、分布与列表不会分别读到不同的提交版本。
export function createDashboardRepository(db: PrismaClient = prisma): DashboardRepository {
  return { read: () => db.$transaction(async (tx) => {
    const groups = await tx.herbBatch.groupBy({
      by: ['stage', 'category', 'auditStatus', 'riskLevel'], _count: { _all: true },
    })
    const recent = await tx.herbBatch.findMany({
      select: recentSelect, take: 6, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    })
    const pending = await tx.herbBatch.findMany({
      select: recentSelect, where: { auditStatus: 'pending' }, take: 5,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    })
    return { groups: groups.map(({ _count, ...group }) => ({ ...group, count: _count._all })), recent, pending }
  }, { isolationLevel: 'RepeatableRead' }) }
}

function publicRow(row: DashboardRow) {
  // 只返回列表必需字段，不返回账号、审核理由、附件或 AI 内部记录。
  return { id: row.id, batchNo: row.batchNo, traceCode: row.traceCode, herbName: row.herbName,
    stage: row.stage, auditStatus: row.auditStatus, riskLevel: row.riskLevel,
    growerName: row.growerOrganization.name, updatedAt: row.updatedAt.toISOString() }
}

export function createDashboardService(repository: DashboardRepository = createDashboardRepository()) {
  return { async overview(user: AuthUser) {
    // 平台管理员与现有批次列表使用同一全平台范围；不提供前端可指定的组织/用户参数。
    if (user.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', '仅管理员可以查看平台概览')
    const { groups, recent, pending } = await repository.read()
    const count = (predicate: (group: CountGroup) => boolean) =>
      groups.reduce((sum, group) => sum + (predicate(group) ? group.count : 0), 0)
    return {
      mode: 'api' as const, generatedAt: new Date().toISOString(),
      summary: { totalBatches: count(() => true), pendingAuditBatches: count((g) => g.auditStatus === 'pending'),
        riskBatches: count((g) => g.riskLevel !== 'normal'), warehousingBatches: count((g) => g.stage === 'warehousing') },
      stageDistribution: stages.map((stage) => ({ stage, count: count((g) => g.stage === stage) })),
      categoryDistribution: categories.map((category) => ({ category, count: count((g) => g.category === category) })),
      recentBatches: recent.map(publicRow), pendingBatches: pending.map(publicRow),
    }
  } }
}

export type DashboardService = ReturnType<typeof createDashboardService>
