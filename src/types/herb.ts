/** 药材批次相关类型与枚举 */

/** 流转阶段：实物在链路中的位置 */
export type Stage =
  | 'planting' // 种植中
  | 'harvested' // 已采收
  | 'processing' // 加工中
  | 'warehousing' // 仓储
  | 'shipped' // 已出库 / 运输
  | 'sold' // 已售

export const STAGE_LABEL: Record<Stage, string> = {
  planting: '种植中',
  harvested: '已采收',
  processing: '加工中',
  warehousing: '仓储',
  shipped: '已出库',
  sold: '已售',
}

/** 合规审核状态（与阶段、风险解耦） */
export type AuditStatus = 'pending' | 'approved' | 'rejected'

export const AUDIT_LABEL: Record<AuditStatus, string> = {
  pending: '待审核',
  approved: '审核通过',
  rejected: '已驳回',
}

/** 风险评估 */
export type RiskLevel = 'normal' | 'low' | 'medium' | 'high'

export const RISK_LABEL: Record<RiskLevel, string> = {
  normal: '正常',
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

/** 药材类别（先少量，后续可扩展） */
export type HerbCategory =
  | 'root'
  | 'wholeHerb'
  | 'fruitSeed'
  | 'flowerLeaf'
  | 'bark'
  | 'mineral'
  | 'other'

export const HERB_CATEGORY_LABEL: Record<HerbCategory, string> = {
  root: '根茎类',
  wholeHerb: '全草类',
  fruitSeed: '果实种子类',
  flowerLeaf: '花叶类',
  bark: '皮类',
  mineral: '矿物类',
  other: '其他',
}

/** 链路事件类型 */
export type EventType =
  | 'create' // 建档 / 上传
  | 'audit' // 审核通过 / 驳回
  | 'stageChange' // 阶段流转
  | 'qcReport' // 质检报告
  | 'storage' // 入库 / 出库
  | 'transport' // 运输
  | 'transaction' // 交易 / 合同
  | 'note' // 备注 / 其他

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  create: '建档',
  audit: '审核',
  stageChange: '阶段变更',
  qcReport: '质检',
  storage: '仓储',
  transport: '运输',
  transaction: '交易',
  note: '备注',
}

/** 事件可见范围：详情页按当前用户角色过滤 */
export type EventScope = 'public' | 'admin' | 'buyer' | 'grower' | 'processor'

export type BatchEvent = {
  id: string
  type: EventType
  title: string
  description?: string
  /** 展示用时间字符串（如 2026-04-29 10:32） */
  occurredAt: string
  operatorName?: string
  operatorRole?: 'admin' | 'grower' | 'processor' | 'buyer' | 'system'
  /** 仅这些角色可见，缺省视为 public（所有已登录用户可见） */
  scopes?: EventScope[]
  fromStage?: Stage
  toStage?: Stage
  attachments?: { name: string; url: string }[]
}

/** 产地结构化字段 */
export type HerbOrigin = {
  province: string
  city: string
  district?: string
  /** 基地 / 地块名称（自由文本） */
  address?: string
}

export type HerbBatch = {
  /** 内部主键 */
  id: string
  /** 业务编号，对人可读：YM-2026-GS-HQ-0318 */
  batchNo: string
  /** 对外溯源码：YM-TRACE-2026-0001 */
  traceCode: string

  herbName: string
  category: HerbCategory

  growerId: string
  growerName: string

  /** 种植开始日期 YYYY-MM-DD */
  plantingStartDate: string
  origin: HerbOrigin

  /** 环境信息（先用自由文本，IoT 时序后置） */
  environment?: string

  coverImageUrl?: string
  description?: string

  stage: Stage
  auditStatus: AuditStatus
  riskLevel: RiskLevel

  createdAt: string
  createdBy: string
  createdByRole: 'admin' | 'grower'
  updatedAt: string

  /** 链路事件，时间正序（早→晚），UI 可反向展示 */
  events: BatchEvent[]
}
