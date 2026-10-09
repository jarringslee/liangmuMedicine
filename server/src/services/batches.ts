// 规定四种角色能查看哪些批次；
// 通过 Prisma 查询列表和详情；
// 使用 select 形成接口白名单，避免直接返回数据库内部字段；
// 过滤不同角色不可见的溯源事件和审核信息；
// 支持依赖注入，方便后续自动化测试。

import { randomUUID } from 'node:crypto'
import type { // 从prisma客户端引入TS类型
    AuditDecision,
    AuditStatus,
    BatchStage,
    HerbCategory,
    Prisma,
    RiskLevel,
} from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/error.js'
import type { AuthUser } from './auth.js'
import { notificationChanges } from './notificationChanges.js'

const organizationSelect = {
    id: true,
    code: true,
    name: true,
    type: true,
    province: true,
    city: true,
} satisfies Prisma.OrganizationSelect

const attachmentSelect = {
    id: true,
    eventId: true,
    originalName: true,
    publicUrl: true,
    mimeType: true,
    sizeBytes: true,
    createdAt: true,
} satisfies Prisma.AttachmentSelect

/**
 * 列表只返回页面展示需要的字段。
 * 不返回 createdById、storageKey、checksum 等内部数据。
 */
const batchSummarySelect = {
    id: true,
    batchNo: true,
    traceCode: true,
    herbName: true,
    category: true,
    plantingStartDate: true,
    origin: true,
    environment: true,
    coverImageUrl: true,
    description: true,
    requiresProcessing: true,
    stage: true,
    auditStatus: true,
    riskLevel: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    growerOrganization: {
        select: organizationSelect,
    },
    processorOrganization: {
        select: organizationSelect,
    },
    buyerOrganization: {
        select: { id: true, name: true },
    },
    createdBy: {
        select: {
            id: true,
            displayName: true,
            role: true,
        },
    },
} satisfies Prisma.HerbBatchSelect

/**
 * 详情在列表字段基础上增加溯源事件、审核记录和附件。
 * 是否允许把这些内容返回给当前角色，由 service 再过滤一次。
 */
const batchDetailSelect = {
    ...batchSummarySelect,
    events: {
        orderBy: [
            { occurredAt: 'asc' },
            { id: 'asc' },
        ],
        select: {
            id: true,
            type: true,
            title: true,
            description: true,
            payload: true,
            occurredAt: true,
            operatorName: true,
            operatorRole: true,
            visibleRoles: true,
            fromStage: true,
            toStage: true,
            createdAt: true,
            attachments: {
                select: attachmentSelect,
            },
        },
    },
    audits: {
        orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
        ],
        select: {
            id: true,
            reviewerName: true,
            decision: true,
            source: true,
            riskLevel: true,
            reason: true,
            evidence: true,
            modelName: true,
            createdAt: true,
        },
    },
    attachments: {
        orderBy: [
            { createdAt: 'asc' },
            { id: 'asc' },
        ],
        select: attachmentSelect,
    },
} satisfies Prisma.HerbBatchSelect

// 导出列表数据对应的TS类型
export type BatchSummaryRecord = Prisma.HerbBatchGetPayload<{
    select: typeof batchSummarySelect
}>

// 导出详情数据对应的TS类型
export type BatchDetailRecord = Prisma.HerbBatchGetPayload<{
    select: typeof batchDetailSelect
}>

// 导出：前端传过来的列表查询参数类型
export type BatchListQuery = { // 接口入参
    page: number          // 当前页码
    pageSize: number      // 每页条数
    search?: string       // 搜索关键词，?代表可选
    stage?: BatchStage    // 批次阶段筛选，可选
    auditStatus?: AuditStatus // 审核状态筛选，可选
    riskLevel?: RiskLevel     // 风险等级筛选，可选
}

export type CreateBatchInput = {
    herbName: string
    category: HerbCategory
    plantingStartDate: string
    origin: {
        province: string
        city: string
        district?: string
        address?: string
    }
    environment?: string
    description?: string
}

export type AuditBatchInput = {
    decision: AuditDecision
    reason?: string
    riskLevel?: RiskLevel
}

export type AppendBatchEventInput = {
    title: string
    description: string
    occurredAt: string
}

export type HarvestBatchInput = {
    harvestDate: string
    yieldKg: number
    plotArea?: string
    harvesterName?: string
    note?: string
}

export type CompleteProcessingInput = {
    note: string
}

export type ProcessingQualityReportInput = {
    summary: string
}

export type DispatchBatchInput = {
    buyerOrganizationId: string
}

export type DispatchRecipient = { id: string; name: string }

// 只允许启用、且至少有一个有效采购账号的采购组织作为收货方。
const dispatchRecipientWhere = {
    type: 'buyer', enabled: true,
    users: { some: { role: 'buyer', status: 'active' } },
} satisfies Prisma.OrganizationWhereInput

// 内部类型：传给数据库查询层的参数
type BatchListRepositoryInput = { // 转译后给 prisma 用的查询参数
    where: Prisma.HerbBatchWhereInput // prisma查询的筛选条件对象
    skip: number          // 跳过多少条（用于分页）
    take: number          // 取多少条（每页数量）
}

type BatchCreateRepositoryInput = CreateBatchInput & {
    batchNo: string
    traceCode: string
    plantingStartDateValue: Date
    growerOrganizationId: string
    creatorId: string
    creatorName: string
}

type BatchAuditRepositoryInput = {
    batchId: string
    decision: AuditDecision
    reason?: string
    riskLevel: RiskLevel
    reviewerId: string
    reviewerName: string
}

type BatchEventRepositoryInput = {
    batchId: string
    title: string
    description: string
    occurredAt: Date
    operatorId: string
    operatorName: string
}

type BatchHarvestRepositoryInput = HarvestBatchInput & {
    batchId: string
    harvestDateValue: Date
    operatorId: string
    operatorName: string
}

type ProcessorRepositoryInput = {
    batchId: string
    expectedVersion: number
    processorOrganizationId: string
    operatorId: string
    operatorName: string
}

type CompleteProcessingRepositoryInput = ProcessorRepositoryInput & {
    note: string
}

type ProcessingQualityReportRepositoryInput = ProcessorRepositoryInput & {
    summary: string
}

type BatchTransitionRepositoryInput = {
    batchId: string
    expectedVersion: number
    operatorId: string
    operatorName: string
}

type BatchDispatchRepositoryInput = BatchTransitionRepositoryInput & DispatchBatchInput
type BatchReceiptRepositoryInput = BatchTransitionRepositoryInput & { buyerOrganizationId: string }

// 导出接口：定义批次数据仓库的方法契约
export interface BatchRepository {
    count(where: Prisma.HerbBatchWhereInput): Promise<number>
    // count：统计符合筛选条件的数据总数；返回Promise包裹的数字
    list(input: BatchListRepositoryInput): Promise<BatchSummaryRecord[]>
    // list：查询批次列表；返回Promise包裹的BatchSummaryRecord数组
    findOne(where: Prisma.HerbBatchWhereInput): Promise<BatchDetailRecord | null>
    // findOne：查询单条批次详情；找到返回详情对象，没找到返回null
    create(input: BatchCreateRepositoryInput): Promise<BatchDetailRecord>
    audit(input: BatchAuditRepositoryInput): Promise<BatchDetailRecord>
    appendEvent(input: BatchEventRepositoryInput): Promise<BatchDetailRecord>
    harvest(input: BatchHarvestRepositoryInput): Promise<BatchDetailRecord>
    receiveProcessing(input: ProcessorRepositoryInput): Promise<BatchDetailRecord | null>
    completeProcessing(input: CompleteProcessingRepositoryInput): Promise<BatchDetailRecord | null>
    saveProcessingQualityReport(input: ProcessingQualityReportRepositoryInput): Promise<BatchDetailRecord | null>
    listDispatchRecipients(): Promise<DispatchRecipient[]>
    dispatch(input: BatchDispatchRepositoryInput): Promise<BatchDetailRecord | null>
    confirmReceipt(input: BatchReceiptRepositoryInput): Promise<BatchDetailRecord | null>
}

type SubmissionResult = { batch: BatchDetailRecord; recipientIds: string[] }
type SubmissionTransaction = (work: (tx: Prisma.TransactionClient) => Promise<SubmissionResult>) => Promise<SubmissionResult>

/** 建档、首条事件和管理员通知共同提交；推送提示必须在事务成功之后。 */
export async function createSubmittedBatch(
    input: BatchCreateRepositoryInput,
    transaction: SubmissionTransaction = (work) => prisma.$transaction(work),
    publish: (ids: string[]) => void = (ids) => notificationChanges.publish(ids),
): Promise<BatchDetailRecord> {
    const { batch, recipientIds } = await transaction(async (tx) => {
        const batch = await tx.herbBatch.create({
            data: {
                batchNo: input.batchNo, traceCode: input.traceCode, herbName: input.herbName,
                category: input.category, plantingStartDate: input.plantingStartDateValue,
                origin: input.origin, environment: input.environment, description: input.description,
                requiresProcessing: true, stage: 'planting', auditStatus: 'pending', riskLevel: 'normal',
                growerOrganization: { connect: { id: input.growerOrganizationId } },
                createdBy: { connect: { id: input.creatorId } },
                events: { create: {
                    type: 'create', title: '批次建档',
                    description: `由种植商 ${input.creatorName} 创建批次，等待平台审核。`,
                    occurredAt: new Date(), operator: { connect: { id: input.creatorId } },
                    operatorName: input.creatorName, operatorRole: 'grower', visibleRoles: [],
                } },
            },
            select: batchDetailSelect,
        })
        const recipients = await tx.user.findMany({
            where: { role: 'admin', status: 'active', OR: [
                { organizationId: null },
                { organization: { is: { type: 'platform', enabled: true } } },
            ] },
            select: { id: true },
        })
        const recipientIds = recipients.map(({ id }) => id)
        if (recipientIds.length) {
            await tx.notification.createMany({ data: recipientIds.map((recipientId) => ({
                recipientId, batchId: batch.id, type: 'batchSubmitted' as const,
                title: '新批次待审核',
                content: `${input.creatorName} 提交了${input.herbName}批次 ${batch.batchNo}，请查看档案并审核。`,
            })) })
        }
        return { batch, recipientIds }
    })
    publish(recipientIds)
    return batch
}

type NotificationMutationResult<T> = {
    result: T
    recipientIds: string[]
}

type NotificationTransaction<T> = (
    work: (
        tx: Prisma.TransactionClient,
    ) => Promise<NotificationMutationResult<T>>,
) => Promise<NotificationMutationResult<T>>

type NotificationPublisher = (recipientIds: string[]) => void

type NotificationDraft = Pick<
    Prisma.NotificationCreateManyInput,
    'batchId' | 'type' | 'title' | 'content'
>

async function activeUserIds(
    tx: Prisma.TransactionClient,
    where: Prisma.UserWhereInput,
): Promise<string[]> {
    const users = await tx.user.findMany({ where, select: { id: true } })
    return users.map(({ id }) => id)
}

async function createNotifications(
    tx: Prisma.TransactionClient,
    recipientIds: string[],
    notification: NotificationDraft,
) {
    if (!recipientIds.length) return
    await tx.notification.createMany({
        data: recipientIds.map((recipientId) => ({
            recipientId,
            ...notification,
        })),
    })
}

function activeGrowerIds(
    tx: Prisma.TransactionClient,
    organizationId: string,
) {
    return activeUserIds(tx, {
        role: 'grower',
        status: 'active',
        organizationId,
        organization: { is: { type: 'grower', enabled: true } },
    })
}

function activeProcessorIds(tx: Prisma.TransactionClient) {
    return activeUserIds(tx, {
        role: 'processor',
        status: 'active',
        organization: { is: { type: 'processor', enabled: true } },
    })
}

function activeAdminIds(tx: Prisma.TransactionClient) {
    return activeUserIds(tx, {
        role: 'admin',
        status: 'active',
        OR: [
            { organizationId: null },
            { organization: { is: { type: 'platform', enabled: true } } },
        ],
    })
}

/** 审核、审核记录、事件和种植商通知同事务提交；采收已完成时同时提醒加工商。 */
export async function auditBatchWithNotifications(
    input: BatchAuditRepositoryInput,
    transaction: NotificationTransaction<BatchDetailRecord> =
        (work) => prisma.$transaction(work),
    publish: NotificationPublisher = (ids) => notificationChanges.publish(ids),
): Promise<BatchDetailRecord> {
    const { result: batch, recipientIds } = await transaction(async (tx) => {
        const batch = await tx.herbBatch.update({
            where: { id: input.batchId },
            data: {
                auditStatus: input.decision,
                riskLevel: input.riskLevel,
                version: { increment: 1 },
                audits: {
                    create: {
                        reviewer: { connect: { id: input.reviewerId } },
                        reviewerName: input.reviewerName,
                        decision: input.decision,
                        source: 'manual',
                        riskLevel: input.riskLevel,
                        reason: input.reason,
                    },
                },
                events: {
                    create: {
                        type: 'audit',
                        title: input.decision === 'approved'
                            ? '管理员审核通过'
                            : '管理员审核驳回',
                        description: input.reason,
                        occurredAt: new Date(),
                        operator: { connect: { id: input.reviewerId } },
                        operatorName: input.reviewerName,
                        operatorRole: 'admin',
                        visibleRoles: [],
                    },
                },
            },
            select: batchDetailSelect,
        })

        const growerIds = await activeGrowerIds(
            tx,
            batch.growerOrganization.id,
        )
        const decisionLabel = input.decision === 'approved' ? '审核通过' : '审核驳回'
        await createNotifications(tx, growerIds, {
            batchId: batch.id,
            type: 'auditResult',
            title: `${batch.herbName}批次${decisionLabel}`,
            content: `${batch.batchNo} 已${decisionLabel}${input.reason ? `：${input.reason}` : '。'}`,
        })

        let processorIds: string[] = []
        if (
            input.decision === 'approved' &&
            batch.stage === 'harvested' &&
            batch.requiresProcessing
        ) {
            processorIds = await activeProcessorIds(tx)
            await createNotifications(tx, processorIds, {
                batchId: batch.id,
                type: 'stageChanged',
                title: `${batch.herbName}批次等待接收加工`,
                content: `${batch.batchNo} 已完成采收并审核通过，可进入加工接收流程。`,
            })
        }

        return {
            result: batch,
            recipientIds: [...new Set([...growerIds, ...processorIds])],
        }
    })

    if (recipientIds.length) publish(recipientIds)
    return batch
}

/** 采收数据、阶段事件和加工商通知同事务提交。 */
export async function harvestBatchWithNotifications(
    input: BatchHarvestRepositoryInput,
    transaction: NotificationTransaction<BatchDetailRecord> =
        (work) => prisma.$transaction(work),
    publish: NotificationPublisher = (ids) => notificationChanges.publish(ids),
): Promise<BatchDetailRecord> {
    const { result: batch, recipientIds } = await transaction(async (tx) => {
        const description =
            `采收日期：${input.harvestDate}\n` +
            `采收数量：${input.yieldKg.toFixed(2)} kg` +
            (input.plotArea ? `\n采收地块：${input.plotArea}` : '') +
            (input.harvesterName ? `\n采收人员：${input.harvesterName}` : '') +
            (input.note ? `\n备注：${input.note}` : '')

        const batch = await tx.herbBatch.update({
            where: { id: input.batchId },
            data: {
                stage: 'harvested',
                version: { increment: 1 },
                events: {
                    create: [
                        {
                            type: 'note',
                            title: '采收登记',
                            description,
                            occurredAt: input.harvestDateValue,
                            operator: { connect: { id: input.operatorId } },
                            operatorName: input.operatorName,
                            operatorRole: 'grower',
                            visibleRoles: [],
                        },
                        {
                            type: 'stageChange',
                            title: '阶段变更：种植中 → 已采收',
                            description: `采收完成：${input.yieldKg.toFixed(2)} kg`,
                            occurredAt: new Date(),
                            operator: { connect: { id: input.operatorId } },
                            operatorName: input.operatorName,
                            operatorRole: 'grower',
                            visibleRoles: [],
                            fromStage: 'planting',
                            toStage: 'harvested',
                        },
                    ],
                },
            },
            select: batchDetailSelect,
        })

        const recipientIds = batch.auditStatus === 'approved' && batch.requiresProcessing
            ? await activeProcessorIds(tx)
            : []
        await createNotifications(tx, recipientIds, {
            batchId: batch.id,
            type: 'stageChanged',
            title: `${batch.herbName}批次等待接收加工`,
            content: `${batch.batchNo} 已完成采收并审核通过，可进入加工接收流程。`,
        })

        return { result: batch, recipientIds }
    })

    if (recipientIds.length) publish(recipientIds)
    return batch
}

/** 加工完成、阶段事件和管理员入库通知同事务提交。 */
export async function completeProcessingWithNotifications(
    input: CompleteProcessingRepositoryInput,
    transaction: NotificationTransaction<BatchDetailRecord | null> =
        (work) => prisma.$transaction(work),
    publish: NotificationPublisher = (ids) => notificationChanges.publish(ids),
): Promise<BatchDetailRecord | null> {
    const { result: batch, recipientIds } = await transaction(async (tx) => {
        const changedAt = new Date()
        const completed = await tx.herbBatch.updateMany({
            where: {
                id: input.batchId,
                version: input.expectedVersion,
                stage: 'processing',
                auditStatus: 'approved',
                processorOrganizationId: input.processorOrganizationId,
            },
            data: {
                stage: 'warehousing',
                version: { increment: 1 },
            },
        })
        if (completed.count !== 1) {
            return { result: null, recipientIds: [] }
        }

        await tx.batchEvent.createMany({
            data: [
                {
                    batchId: input.batchId,
                    type: 'note',
                    title: '加工完成记录',
                    description: input.note,
                    occurredAt: changedAt,
                    operatorId: input.operatorId,
                    operatorName: input.operatorName,
                    operatorRole: 'processor',
                    visibleRoles: [],
                },
                {
                    batchId: input.batchId,
                    type: 'stageChange',
                    title: '阶段变更：加工中 → 仓储',
                    description: '加工完成，批次进入仓储阶段。',
                    occurredAt: changedAt,
                    operatorId: input.operatorId,
                    operatorName: input.operatorName,
                    operatorRole: 'processor',
                    visibleRoles: [],
                    fromStage: 'processing',
                    toStage: 'warehousing',
                },
            ],
        })

        const batch = await tx.herbBatch.findUnique({
            where: { id: input.batchId },
            select: batchDetailSelect,
        })
        if (!batch) return { result: null, recipientIds: [] }

        const recipientIds = await activeAdminIds(tx)
        await createNotifications(tx, recipientIds, {
            batchId: batch.id,
            type: 'stageChanged',
            title: `${batch.herbName}批次已完成加工入库`,
            content: `${batch.batchNo} 已由${input.operatorName}完成加工并进入仓储，请查看最新档案。`,
        })

        return { result: batch, recipientIds }
    })

    if (batch && recipientIds.length) publish(recipientIds)
    return batch
}

// 创建实例，实现上面 BatchRepository 接口
const repository: BatchRepository = {
    listDispatchRecipients: () => prisma.organization.findMany({
        where: dispatchRecipientWhere,
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    count: (where) => prisma.herbBatch.count({ where }),
    // count方法：调用prisma统计符合where条件的数据条数

    list: ({ where, skip, take }) =>
        prisma.herbBatch.findMany({
            where,        // 查询筛选条件
            skip,         // 跳过条目，分页用
            take,         // 取出条目，分页用
            orderBy: [    // 排序：先更新时间倒序，再id升序
                { updatedAt: 'desc' },
                { id: 'asc' },
            ],
            select: batchSummarySelect, // 使用列表精简字段配置
        }),

    findOne: (where) =>
        prisma.herbBatch.findFirst({
            where,
            select: batchDetailSelect, // 使用详情完整字段配置
        }),

    create: createSubmittedBatch,

    audit: auditBatchWithNotifications,

    appendEvent: (input) =>
        prisma.herbBatch.update({
            where: { id: input.batchId },
            data: {
                version: { increment: 1 },
                events: {
                    create: {
                        type: 'note',
                        title: input.title,
                        description: input.description,
                        occurredAt: input.occurredAt,
                        operator: {
                            connect: { id: input.operatorId },
                        },
                        operatorName: input.operatorName,
                        operatorRole: 'grower',
                        visibleRoles: [],
                    },
                },
            },
            select: batchDetailSelect,
        }),

    harvest: harvestBatchWithNotifications,

    receiveProcessing: (input) => prisma.$transaction(async (transaction) => {
        const changedAt = new Date()
        const claimed = await transaction.herbBatch.updateMany({
            where: {
                id: input.batchId,
                version: input.expectedVersion,
                stage: 'harvested',
                auditStatus: 'approved',
                OR: [
                    { processorOrganizationId: null },
                    { processorOrganizationId: input.processorOrganizationId },
                ],
            },
            data: {
                processorOrganizationId: input.processorOrganizationId,
                stage: 'processing',
                version: { increment: 1 },
            },
        })
        if (claimed.count !== 1) return null

        await transaction.batchEvent.create({
            data: {
                batchId: input.batchId,
                type: 'stageChange',
                title: '阶段变更：已采收 → 加工中',
                description: '加工商已接收该批次。',
                occurredAt: changedAt,
                operatorId: input.operatorId,
                operatorName: input.operatorName,
                operatorRole: 'processor',
                visibleRoles: [],
                fromStage: 'harvested',
                toStage: 'processing',
            },
        })

        return transaction.herbBatch.findUnique({
            where: { id: input.batchId },
            select: batchDetailSelect,
        })
    }),

    completeProcessing: completeProcessingWithNotifications,

    saveProcessingQualityReport: (input) => prisma.$transaction(async (transaction) => {
        const changedAt = new Date()
        const recorded = await transaction.herbBatch.updateMany({
            where: {
                id: input.batchId,
                version: input.expectedVersion,
                stage: { in: ['processing', 'warehousing'] },
                auditStatus: 'approved',
                processorOrganizationId: input.processorOrganizationId,
            },
            data: {
                version: { increment: 1 },
            },
        })
        if (recorded.count !== 1) return null

        await transaction.batchEvent.create({
            data: {
                batchId: input.batchId,
                type: 'qcReport',
                title: '加工质检报告',
                description: input.summary,
                occurredAt: changedAt,
                operatorId: input.operatorId,
                operatorName: input.operatorName,
                operatorRole: 'processor',
                visibleRoles: [],
            },
        })

        return transaction.herbBatch.findUnique({
            where: { id: input.batchId },
            select: batchDetailSelect,
        })
    }),

    dispatch: (input) => prisma.$transaction(async (transaction) => {
        // 前端候选项可能过期，事务内重新检查；不信任提交的组织名称/类型。
        const recipient = await transaction.organization.findFirst({
            where: { ...dispatchRecipientWhere, id: input.buyerOrganizationId },
            select: { id: true },
        })
        if (!recipient) {
            throw new HttpError(400, 'INVALID_DISPATCH_RECIPIENT', '请选择有效的采购组织')
        }
        const changedAt = new Date()
        const dispatched = await transaction.herbBatch.updateMany({
            where: {
                id: input.batchId,
                version: input.expectedVersion,
                stage: 'warehousing',
                auditStatus: 'approved',
                buyerOrganizationId: null,
            },
            data: {
                stage: 'shipped',
                buyerOrganizationId: input.buyerOrganizationId,
                version: { increment: 1 },
            },
        })
        if (dispatched.count !== 1) return null

        await transaction.batchEvent.create({
            data: {
                batchId: input.batchId,
                type: 'stageChange',
                title: '阶段变更：仓储 → 已出库',
                description: '管理员已确认出库，批次进入运输环节。',
                occurredAt: changedAt,
                operatorId: input.operatorId,
                operatorName: input.operatorName,
                operatorRole: 'admin',
                visibleRoles: [],
                fromStage: 'warehousing',
                toStage: 'shipped',
            },
        })

        return transaction.herbBatch.findUnique({
            where: { id: input.batchId },
            select: batchDetailSelect,
        })
    }),

    confirmReceipt: (input) => prisma.$transaction(async (transaction) => {
        const changedAt = new Date()
        const confirmed = await transaction.herbBatch.updateMany({
            where: {
                id: input.batchId,
                version: input.expectedVersion,
                stage: 'shipped',
                auditStatus: 'approved',
                buyerOrganizationId: input.buyerOrganizationId,
                buyerOrganization: { is: { type: 'buyer', enabled: true } },
            },
            data: {
                stage: 'sold',
                version: { increment: 1 },
            },
        })
        if (confirmed.count !== 1) return null

        await transaction.batchEvent.create({
            data: {
                batchId: input.batchId,
                type: 'stageChange',
                title: '阶段变更：已出库 → 已售',
                description: '采购商已确认收货，批次完成本次流转。',
                occurredAt: changedAt,
                operatorId: input.operatorId,
                operatorName: input.operatorName,
                operatorRole: 'buyer',
                visibleRoles: [],
                fromStage: 'shipped',
                toStage: 'sold',
            },
        })

        return transaction.herbBatch.findUnique({
            where: { id: input.batchId },
            select: batchDetailSelect,
        })
    }),
}

// 函数：从登录用户信息取出组织ID，没有就抛403权限错误
// 当前鉴权链路已先校验组织；这里负责类型收窄，并防止 service 被独立调用时缺少隔离条件
function requireOrganizationId(user: AuthUser): string {
    if (!user.organizationId) {  // 判断用户不存在组织ID
        throw new HttpError(       // 抛出自定义异常
            403,                     // HTTP状态码：无权限
            'INVALID_ORGANIZATION',  // 错误编码（程序识别用）
            '账号的组织配置不正确',    // 给前端看的错误提示
        )
    }

    return user.organizationId    // 校验通过，返回组织id字符串
}

/**
 * 生成数据过滤条件，控制每个角色能看到哪些批次数据（行级数据权限）
 * 数据权限必须根据服务端认证后的 user 构造。
 * 不接受前端传入 organizationId，否则用户可以伪造组织身份。
 */
function visibilityWhere(user: AuthUser): Prisma.HerbBatchWhereInput {
    // 根据用户角色，生成Prisma查询的where筛选条件（数据权限）
    switch (user.role) {
        case 'admin':
            return {} // 管理员：没有额外筛选，能查全部批次
        case 'grower':
            return {
                // 种植商：只能查到自己组织作为种植机构的批次
                growerOrganizationId: requireOrganizationId(user),
            }
        case 'processor':
            return {
                // 已认领批次只对所属加工组织可见；未分配且可加工的批次进入共享待认领池。
                OR: [
                    {
                        processorOrganizationId: requireOrganizationId(user),
                    },
                    {
                        processorOrganizationId: null,
                        auditStatus: 'approved',
                        stage: 'harvested',
                    },
                ],
            }
        case 'buyer':
            return {
                // 采购商：只能查到审核通过的批次，不限组织
                auditStatus: 'approved',
            }
    }
}

// 组装全部查询筛选条件：权限条件 + 搜索 + 阶段/审核状态/风险等级
function listWhere(
    user: AuthUser,        // 当前登录用户
    query: BatchListQuery, // 前端传的查询参数
): Prisma.HerbBatchWhereInput {
    // 条件数组，第一个固定是 数据权限过滤
    const conditions: Prisma.HerbBatchWhereInput[] = [
        visibilityWhere(user),
    ]

    // 有搜索词：多字段模糊搜索，满足任意一个字段匹配即可
    if (query.search) {
        conditions.push({
            OR: [
                {
                    herbName: {
                        contains: query.search,
                        mode: 'insensitive', // 不区分大小写
                    },
                },
                {
                    batchNo: {
                        contains: query.search,
                        mode: 'insensitive',
                    },
                },
                {
                    traceCode: {
                        contains: query.search,
                        mode: 'insensitive',
                    },
                },
            ],
        })
    }

    // 如果前端传了批次阶段，追加条件
    if (query.stage) {
        conditions.push({ stage: query.stage })
    }

    // 如果前端传了审核状态，追加条件
    if (query.auditStatus) {
        conditions.push({ auditStatus: query.auditStatus })
    }

    // 如果前端传了风险等级，追加条件
    if (query.riskLevel) {
        conditions.push({ riskLevel: query.riskLevel })
    }

    // 把数组里所有条件合并成 AND（全部条件必须同时满足）
    return { AND: conditions }
}

// 生成查询单条批次详情的where过滤条件
function detailWhere(
    user: AuthUser,          // 当前登录用户
    identifier: string,     // 前端传的标识，可以是id、溯源码或者批次号
): Prisma.HerbBatchWhereInput {
    return {
        AND: [
            visibilityWhere(user), // 带上角色权限过滤（必选）
            {
                OR: [
                    { id: identifier },         // 匹配批次id
                    { traceCode: identifier },   // 或者匹配溯源码
                    { batchNo: identifier },     // 同样受上面的角色/组织范围约束
                ],
            },
        ],
    }
}

/**
 * 根据当前用户角色，对已经取得的批次详情做字段级脱敏。
 *
 * 注意：
 * 1. 它不负责判断用户能不能查看这个批次；
 * 2. 它只过滤详情中的事件和审核记录；
 * 3. 批次访问范围应当由 detailWhere 等查询条件提前限制。
 */
function filterDetailForRole(
    batch: BatchDetailRecord,
    user: AuthUser,
): BatchDetailRecord & { canConfirmReceipt: boolean } {
    const events = batch.events.filter((event) => {
        // 管理员可以查看全部溯源事件
        if (user.role === 'admin') return true

        // 空数组表示不限制角色，否则只有指定角色可以查看
        return (
            event.visibleRoles.length === 0 ||
            event.visibleRoles.includes(user.role)
        )
    })

    return {
        ...filterSummaryForRole(batch, user),

        // 必须写在 ...batch 后面，才能覆盖原始的完整事件列表
        events,

        // 非管理员不返回审核记录。
        // 如果证据、模型名称等是 audit 内部字段，也会一起被隐藏。
        audits: user.role === 'admin' ? batch.audits : [],
    }
}

/** 浏览已审核批次不等于可收货；其他采购组织不能获知收货方身份。 */
function filterSummaryForRole<T extends BatchSummaryRecord>(batch: T, user: AuthUser): T & { canConfirmReceipt: boolean } {
    const ownsReceipt = user.role === 'buyer' && !!user.organizationId &&
        batch.buyerOrganization?.id === user.organizationId
    return {
        ...batch,
        buyerOrganization: user.role === 'admin' || ownsReceipt ? batch.buyerOrganization : null,
        canConfirmReceipt: ownsReceipt && batch.auditStatus === 'approved' && batch.stage === 'shipped',
    }
}

function newBatchCodes() {
    const year = new Date().getUTCFullYear()
    const suffix = randomUUID()
        .replaceAll('-', '')
        .slice(0, 10)
        .toUpperCase()

    return {
        batchNo: `YM-${year}-${suffix}`,
        traceCode: `YM-TRACE-${year}-${suffix}`,
    }
}

/** 项目业务日期按中国标准时间判断，避免 UTC 服务器在凌晨误判“今天”。 */
function currentBusinessDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

function assertGrowerCanRecord(
    user: AuthUser,
    batch: BatchDetailRecord,
) {
    if (user.role !== 'grower') {
        throw new HttpError(403, 'FORBIDDEN', '仅种植商可以记录生产信息')
    }
    if (batch.auditStatus === 'rejected') {
        throw new HttpError(409, 'BATCH_REJECTED', '该批次已被驳回，暂不能继续记录')
    }
    if (batch.stage !== 'planting') {
        throw new HttpError(409, 'INVALID_BATCH_STAGE', '仅种植中批次可以执行该操作')
    }
}

// 工厂函数：创建批次业务服务，依赖 BatchRepository
export function createBatchService(
    batches: BatchRepository = repository,
) {
    return {
        async dispatchRecipients(user: AuthUser) {
            if (user.role !== 'admin') {
                throw new HttpError(403, 'FORBIDDEN', '仅管理员可以查询出库采购组织')
            }
            return { items: await batches.listDispatchRecipients() }
        },
        async list(user: AuthUser, query: BatchListQuery) {
            // 拼接权限+筛选条件
            const where = listWhere(user, query)
            // 计算分页跳过多少条
            const skip = (query.page - 1) * query.pageSize

            // 并发请求：同时查总条数和当前页数据
            const [total, items] = await Promise.all([
                batches.count(where),
                batches.list({
                    where,
                    skip,
                    take: query.pageSize,
                }),
            ])

            // 组装分页结果返回
            return {
                items: items.map((batch) => filterSummaryForRole(batch, user)),
                pagination: {
                    page: query.page,
                    pageSize: query.pageSize,
                    total,
                    totalPages: Math.ceil(total / query.pageSize),
                },
            }
        },

        async detail(user: AuthUser, identifier: string) {
            // 用带权限的条件去数据库查单条批次
            const batch = await batches.findOne(
                detailWhere(user, identifier),
            )

            /**
             * 重点安全策略：
             * 找不到记录 或者 有权限过滤后查不到，统一返回404
             * 防止别人暴力探测别的组织有没有某个批次
             */
            if (!batch) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }

            // 内存裁剪敏感子数据（events、audits），再返回
            return filterDetailForRole(batch, user)
        },

        async create(user: AuthUser, input: CreateBatchInput) {
            if (user.role !== 'grower') {
                throw new HttpError(403, 'FORBIDDEN', '仅种植商可以创建批次')
            }

            const growerOrganizationId = requireOrganizationId(user)
            const plantingStartDateValue = new Date(
                `${input.plantingStartDate}T00:00:00.000Z`,
            )
            if (input.plantingStartDate > currentBusinessDate()) {
                throw new HttpError(
                    400,
                    'INVALID_PLANTING_DATE',
                    '种植开始日期不能晚于今天',
                )
            }

            const batch = await batches.create({
                ...input,
                ...newBatchCodes(),
                plantingStartDateValue,
                growerOrganizationId,
                creatorId: user.id,
                creatorName: user.displayName,
            })

            return filterDetailForRole(batch, user)
        },

        async audit(
            user: AuthUser,
            identifier: string,
            input: AuditBatchInput,
        ) {
            if (user.role !== 'admin') {
                throw new HttpError(403, 'FORBIDDEN', '仅管理员可以审核批次')
            }

            const current = await batches.findOne(
                detailWhere(user, identifier),
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            if (current.auditStatus === input.decision) {
                throw new HttpError(
                    409,
                    'AUDIT_STATUS_UNCHANGED',
                    '批次已经处于该审核状态',
                )
            }

            const batch = await batches.audit({
                batchId: current.id,
                decision: input.decision,
                reason: input.reason,
                riskLevel: input.riskLevel ?? current.riskLevel,
                reviewerId: user.id,
                reviewerName: user.displayName,
            })

            return filterDetailForRole(batch, user)
        },

        async appendEvent(
            user: AuthUser,
            identifier: string,
            input: AppendBatchEventInput,
        ) {
            if (user.role !== 'grower') {
                throw new HttpError(403, 'FORBIDDEN', '仅种植商可以记录种植日志')
            }
            const current = await batches.findOne(
                detailWhere(user, identifier),
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            assertGrowerCanRecord(user, current)

            const occurredAt = new Date(input.occurredAt)
            if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
                throw new HttpError(400, 'INVALID_EVENT_TIME', '记录时间不能晚于当前时间')
            }
            const batch = await batches.appendEvent({
                batchId: current.id,
                title: input.title,
                description: input.description,
                occurredAt,
                operatorId: user.id,
                operatorName: user.displayName,
            })
            return filterDetailForRole(batch, user)
        },

        async harvest(
            user: AuthUser,
            identifier: string,
            input: HarvestBatchInput,
        ) {
            if (user.role !== 'grower') {
                throw new HttpError(403, 'FORBIDDEN', '仅种植商可以登记采收')
            }
            const current = await batches.findOne(
                detailWhere(user, identifier),
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            assertGrowerCanRecord(user, current)

            const harvestDateValue = new Date(
                `${input.harvestDate}T00:00:00+08:00`,
            )
            if (input.harvestDate > currentBusinessDate()) {
                throw new HttpError(400, 'INVALID_HARVEST_DATE', '采收日期不能晚于今天')
            }

            const batch = await batches.harvest({
                ...input,
                batchId: current.id,
                harvestDateValue,
                operatorId: user.id,
                operatorName: user.displayName,
            })
            return filterDetailForRole(batch, user)
        },

        async receiveProcessing(
            user: AuthUser,
            identifier: string,
        ) {
            if (user.role !== 'processor') {
                throw new HttpError(403, 'FORBIDDEN', '仅加工商可以接收加工批次')
            }
            const processorOrganizationId = requireOrganizationId(user)
            const current = await batches.findOne(
                detailWhere(user, identifier),
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            if (current.auditStatus !== 'approved') {
                throw new HttpError(409, 'BATCH_NOT_APPROVED', '仅审核通过的批次可以接收加工')
            }
            if (current.stage !== 'harvested') {
                throw new HttpError(409, 'INVALID_BATCH_STAGE', '仅已采收批次可以接收加工')
            }

            const batch = await batches.receiveProcessing({
                batchId: current.id,
                expectedVersion: current.version,
                processorOrganizationId,
                operatorId: user.id,
                operatorName: user.displayName,
            })
            if (!batch) {
                throw new HttpError(
                    409,
                    'BATCH_STATE_CHANGED',
                    '批次已被其他加工商接收或状态已变更，请刷新后重试',
                )
            }
            return filterDetailForRole(batch, user)
        },

        async completeProcessing(
            user: AuthUser,
            identifier: string,
            input: CompleteProcessingInput,
        ) {
            if (user.role !== 'processor') {
                throw new HttpError(403, 'FORBIDDEN', '仅加工商可以完成加工')
            }
            const processorOrganizationId = requireOrganizationId(user)
            const current = await batches.findOne(
                detailWhere(user, identifier),
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            if (current.processorOrganization?.id !== processorOrganizationId) {
                throw new HttpError(404, 'BATCH_NOT_FOUND', '药材批次不存在或无权查看')
            }
            if (current.auditStatus !== 'approved') {
                throw new HttpError(409, 'BATCH_NOT_APPROVED', '仅审核通过的批次可以完成加工')
            }
            if (current.stage !== 'processing') {
                throw new HttpError(409, 'INVALID_BATCH_STAGE', '仅加工中批次可以完成加工')
            }

            const batch = await batches.completeProcessing({
                batchId: current.id,
                expectedVersion: current.version,
                processorOrganizationId,
                operatorId: user.id,
                operatorName: user.displayName,
                note: input.note,
            })
            if (!batch) {
                throw new HttpError(409, 'BATCH_STATE_CHANGED', '批次状态已变更，请刷新后重试')
            }
            return filterDetailForRole(batch, user)
        },

        async saveProcessingQualityReport(
            user: AuthUser,
            identifier: string,
            input: ProcessingQualityReportInput,
        ) {
            if (user.role !== 'processor') {
                throw new HttpError(403, 'FORBIDDEN', '仅加工商可以保存加工质检记录')
            }
            const processorOrganizationId = requireOrganizationId(user)
            const current = await batches.findOne(
                detailWhere(user, identifier),
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            if (current.processorOrganization?.id !== processorOrganizationId) {
                throw new HttpError(404, 'BATCH_NOT_FOUND', '药材批次不存在或无权查看')
            }
            if (current.auditStatus !== 'approved') {
                throw new HttpError(409, 'BATCH_NOT_APPROVED', '仅审核通过的批次可以保存质检记录')
            }
            if (!['processing', 'warehousing'].includes(current.stage)) {
                throw new HttpError(409, 'INVALID_BATCH_STAGE', '仅加工中或仓储批次可以保存质检记录')
            }

            const batch = await batches.saveProcessingQualityReport({
                batchId: current.id,
                expectedVersion: current.version,
                processorOrganizationId,
                operatorId: user.id,
                operatorName: user.displayName,
                summary: input.summary,
            })
            if (!batch) {
                throw new HttpError(409, 'BATCH_STATE_CHANGED', '批次状态已变更，请刷新后重试')
            }
            return filterDetailForRole(batch, user)
        },

        async dispatch(
            user: AuthUser,
            identifier: string,
            input: DispatchBatchInput,
        ) {
            if (user.role !== 'admin') {
                throw new HttpError(403, 'FORBIDDEN', '仅管理员可以确认批次出库')
            }
            if (typeof input?.buyerOrganizationId !== 'string' || !input.buyerOrganizationId.trim() ||
                input.buyerOrganizationId.length > 100) {
                throw new HttpError(400, 'INVALID_DISPATCH_RECIPIENT', '请选择有效的采购组织')
            }
            const current = await batches.findOne(
                detailWhere(user, identifier),
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            if (current.auditStatus !== 'approved') {
                throw new HttpError(409, 'BATCH_NOT_APPROVED', '仅审核通过的批次可以出库')
            }
            if (current.stage !== 'warehousing') {
                throw new HttpError(409, 'INVALID_BATCH_STAGE', '仅仓储阶段批次可以出库')
            }

            const batch = await batches.dispatch({
                batchId: current.id,
                expectedVersion: current.version,
                buyerOrganizationId: input.buyerOrganizationId,
                operatorId: user.id,
                operatorName: user.displayName,
            })
            if (!batch) {
                throw new HttpError(409, 'BATCH_STATE_CHANGED', '批次状态已变更，请刷新后重试')
            }
            return filterDetailForRole(batch, user)
        },

        async confirmReceipt(
            user: AuthUser,
            identifier: string,
        ) {
            if (user.role !== 'buyer') {
                throw new HttpError(403, 'FORBIDDEN', '仅采购商可以确认收货')
            }
            const buyerOrganizationId = requireOrganizationId(user)
            const current = await batches.findOne(
                { AND: [detailWhere(user, identifier), { buyerOrganizationId }] },
            )
            if (!current) {
                throw new HttpError(
                    404,
                    'BATCH_NOT_FOUND',
                    '药材批次不存在或无权查看',
                )
            }
            if (current.auditStatus !== 'approved') {
                throw new HttpError(409, 'BATCH_NOT_APPROVED', '仅审核通过的批次可以确认收货')
            }
            if (current.stage !== 'shipped') {
                throw new HttpError(409, 'INVALID_BATCH_STAGE', '仅已出库批次可以确认收货')
            }

            const batch = await batches.confirmReceipt({
                batchId: current.id,
                expectedVersion: current.version,
                buyerOrganizationId,
                operatorId: user.id,
                operatorName: user.displayName,
            })
            if (!batch) {
                throw new HttpError(409, 'BATCH_STATE_CHANGED', '批次状态已变更，请刷新后重试')
            }
            return filterDetailForRole(batch, user)
        },
    }
}

// 根据createBatchService返回值，自动生成BatchService类型
export type BatchService = ReturnType<typeof createBatchService>


