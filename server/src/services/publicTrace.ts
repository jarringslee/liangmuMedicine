import type { BatchEventType, Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/error.js'

export const PUBLIC_TRACE_CODE_REGEX = /^YM-TRACE-\d{4}-[A-Z0-9]+(?:-[A-Z0-9]+)*$/
const publicEventTypes: BatchEventType[] = ['create', 'stageChange', 'qcReport', 'storage', 'transport']
const eventLimit = 100

// 数据库先少取字段，响应再逐项组装；不是获取完整详情后由前端隐藏。
const publicTraceSelect = {
  traceCode: true, batchNo: true, herbName: true, category: true, origin: true,
  plantingStartDate: true, stage: true, auditStatus: true, riskLevel: true,
  createdAt: true, updatedAt: true,
  growerOrganization: { select: { name: true, type: true, enabled: true } },
  processorOrganization: { select: { name: true, type: true, enabled: true } },
  events: {
    where: { visibleRoles: { isEmpty: true }, type: { in: publicEventTypes } },
    select: { type: true, occurredAt: true, fromStage: true, toStage: true, visibleRoles: true },
    orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }], take: eventLimit + 1,
  },
} satisfies Prisma.HerbBatchSelect

export type PublicTraceRecord = Prisma.HerbBatchGetPayload<{ select: typeof publicTraceSelect }>
export type PublicTraceRepository = { find: (traceCode: string) => Promise<PublicTraceRecord | null> }

export function createPublicTraceRepository(db: PrismaClient = prisma): PublicTraceRepository {
  return { find: (traceCode) => db.$transaction((tx) => tx.herbBatch.findFirst({
    where: { traceCode, auditStatus: 'approved', growerOrganization: { enabled: true, type: 'grower' } },
    select: publicTraceSelect,
  }), { isolationLevel: 'RepeatableRead' }) }
}

function notFound(): never {
  // 未知、未审核、驳回和机构停用统一响应，不能通过匿名接口猜审核状态。
  throw new HttpError(404, 'NOT_FOUND', '档案不存在或暂不可公开')
}

function publicOrigin(value: Prisma.JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.province !== 'string' || !value.province.trim()
    || typeof value.city !== 'string' || !value.city.trim()) {
    throw new HttpError(500, 'INVALID_PUBLIC_DATA', '公开档案数据暂不可用')
  }
  return {
    province: value.province, city: value.city,
    ...(typeof value.district === 'string' && value.district.trim() ? { district: value.district } : {}),
  }
}

export function createPublicTraceService(repository: PublicTraceRepository = createPublicTraceRepository()) {
  return { async detail(identifier: string) {
    const traceCode = identifier.trim().toUpperCase()
    if (traceCode.length > 80 || !PUBLIC_TRACE_CODE_REGEX.test(traceCode)) return notFound()
    const batch = await repository.find(traceCode)
    // service 不依赖路由鉴权，也不把仓储层筛选作为唯一防线。
    if (!batch || batch.traceCode !== traceCode || batch.auditStatus !== 'approved'
      || !batch.growerOrganization.enabled || batch.growerOrganization.type !== 'grower') return notFound()
    const events = batch.events.filter((event) => event.visibleRoles.length === 0 && publicEventTypes.includes(event.type))
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    const processor = batch.processorOrganization
    return {
      traceCode: batch.traceCode, batchNo: batch.batchNo, herbName: batch.herbName,
      category: batch.category, origin: publicOrigin(batch.origin),
      growerName: batch.growerOrganization.name,
      ...(processor?.enabled && processor.type === 'processor' ? { processorName: processor.name } : {}),
      plantingStartDate: batch.plantingStartDate.toISOString().slice(0, 10),
      stage: batch.stage, auditStatus: 'approved' as const, riskLevel: batch.riskLevel,
      createdAt: batch.createdAt.toISOString(), updatedAt: batch.updatedAt.toISOString(),
      events: events.slice(0, eventLimit).map((event) => ({
        type: event.type as 'create' | 'stageChange' | 'qcReport' | 'storage' | 'transport',
        occurredAt: event.occurredAt.toISOString(),
        ...(event.type === 'stageChange' && event.fromStage ? { fromStage: event.fromStage } : {}),
        ...(event.type === 'stageChange' && event.toStage ? { toStage: event.toStage } : {}),
      })),
      eventsTruncated: events.length > eventLimit,
    }
  } }
}

export type PublicTraceService = ReturnType<typeof createPublicTraceService>
