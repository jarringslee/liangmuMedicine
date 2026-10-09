// 公开页面使用独立 DTO，不直接拿完整 HerbBatch 隐藏几列。

import type { HerbCategory, RiskLevel, Stage } from './herb'

// 公开节点不包含审核意见、自由文本备注或交易记录。
export type PublicTraceEventType =
    | 'create'
    | 'stageChange'
    | 'qcReport'
    | 'storage'
    | 'transport'

export type PublicTraceBatch = {
    traceCode: string
    batchNo: string
    herbName: string
    category: HerbCategory

    // 只展示省、市、区县，不包含基地详细地址。
    origin: {
        province: string
        city: string
        district?: string
    }

    growerName: string
    processorName?: string
    plantingStartDate: string

    stage: Stage
    auditStatus: 'approved'
    riskLevel: RiskLevel

    // 带时区的 ISO 时间字符串。
    createdAt: string
    updatedAt: string

    events: {
        type: PublicTraceEventType
        occurredAt: string
        fromStage?: Stage
        toStage?: Stage
    }[]

    // 公开接口最多返回最近 100 个节点。
    eventsTruncated: boolean
}