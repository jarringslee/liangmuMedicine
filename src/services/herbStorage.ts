/**
 * 药材批次数据访问层
 *
 * - 基础样例来自 `/public/data/herb-batches.json`
 * - 用户在前端新增/修改的批次以「覆盖层」形式写入 localStorage
 * - 所有方法均为 async，后续可无痛替换为真实 API
 */

import type { AuditStatus, BatchEvent, HerbBatch, HerbCategory, HerbOrigin, RiskLevel, Stage } from '../types/herb'
import { STAGE_LABEL } from '../types/herb'

const STORAGE_KEY = 'liangmu_herb_overrides'
const DATA_URL = `${import.meta.env.BASE_URL}data/herb-batches.json`

type Overrides = {
  additions: HerbBatch[]
  updates: Record<string, Partial<HerbBatch>>
}

type RemoteFile = {
  version: number
  batches: HerbBatch[]
}

let bundledCache: HerbBatch[] | null = null

function emptyOverrides(): Overrides {
  return { additions: [], updates: {} }
}

function readOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyOverrides()
    const parsed = JSON.parse(raw) as Partial<Overrides>
    return {
      additions: Array.isArray(parsed.additions) ? parsed.additions : [],
      updates: parsed.updates && typeof parsed.updates === 'object' ? parsed.updates : {},
    }
  } catch {
    return emptyOverrides()
  }
}

function writeOverrides(next: Overrides): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event('herb-changed'))
}

async function loadBundled(): Promise<HerbBatch[]> {
  if (bundledCache) return bundledCache
  const res = await fetch(DATA_URL, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`无法加载药材样例数据：${res.status}`)
  const data = (await res.json()) as RemoteFile
  bundledCache = data.batches ?? []
  return bundledCache
}

function mergeOne(base: HerbBatch, patch: Partial<HerbBatch>): HerbBatch {
  return { ...base, ...patch, updatedAt: patch.updatedAt ?? base.updatedAt }
}

/** 读取「样例 + 覆盖层」合并后的全量列表 */
export async function listBatches(): Promise<HerbBatch[]> {
  const base = await loadBundled()
  const { additions, updates } = readOverrides()

  const merged = base.map((b) => (updates[b.id] ? mergeOne(b, updates[b.id]!) : b))
  /** 用户新增的放最前面，便于第一眼看到 */
  return [...additions, ...merged]
}

export async function getById(id: string): Promise<HerbBatch | null> {
  const all = await listBatches()
  return all.find((b) => b.id === id) ?? null
}

export async function getByTraceCode(traceCode: string): Promise<HerbBatch | null> {
  const all = await listBatches()
  const code = traceCode.trim().toUpperCase()
  return all.find((b) => b.traceCode.toUpperCase() === code) ?? null
}

/** 全量已用过的 traceCode（用于生成时避重） */
async function listExistingTraceCodes(): Promise<Set<string>> {
  const all = await listBatches()
  return new Set(all.map((b) => b.traceCode))
}

/** 字段重叠常量 */
const TRACE_PREFIX = 'YM-TRACE'

function currentYear(): number {
  return new Date().getFullYear()
}

function pad4(n: number): string {
  return String(n).padStart(4, '0')
}

/** 生成下一个 traceCode：YM-TRACE-YYYY-XXXX */
export async function generateNextTraceCode(): Promise<string> {
  const year = currentYear()
  const existing = await listExistingTraceCodes()
  let n = 1
  while (existing.has(`${TRACE_PREFIX}-${year}-${pad4(n)}`)) n += 1
  return `${TRACE_PREFIX}-${year}-${pad4(n)}`
}

/** 省份 → GB 标准两字母码（用于纯 ASCII 批次号） */
const PROVINCE_CODE: Record<string, string> = {
  北京: 'BJ', 天津: 'TJ', 河北: 'HE', 山西: 'SX', 内蒙古: 'NM',
  辽宁: 'LN', 吉林: 'JL', 黑龙江: 'HL', 上海: 'SH', 江苏: 'JS',
  浙江: 'ZJ', 安徽: 'AH', 福建: 'FJ', 江西: 'JX', 山东: 'SD',
  河南: 'HA', 湖北: 'HB', 湖南: 'HN', 广东: 'GD', 广西: 'GX',
  海南: 'HI', 重庆: 'CQ', 四川: 'SC', 贵州: 'GZ', 云南: 'YN',
  西藏: 'XZ', 陕西: 'SN', 甘肃: 'GS', 青海: 'QH', 宁夏: 'NX',
  新疆: 'XJ', 香港: 'HK', 澳门: 'MO', 台湾: 'TW',
}

/** 药材类别 → 两字母码 */
const CATEGORY_CODE: Record<HerbCategory, string> = {
  root: 'RT',
  wholeHerb: 'WH',
  fruitSeed: 'FS',
  flowerLeaf: 'FL',
  bark: 'BK',
  mineral: 'MN',
  other: 'OT',
}

function toProvinceCode(province: string): string {
  const hit = Object.keys(PROVINCE_CODE).find((k) => province.includes(k))
  return hit ? PROVINCE_CODE[hit]! : 'XX'
}

/** 生成纯 ASCII 业务编号：YM-{年}-{省份码}-{类别码}-{序号}，如 YM-2026-SN-RT-0002 */
export async function generateNextBatchNo(params: {
  origin: HerbOrigin
  category: HerbCategory
}): Promise<string> {
  const year = currentYear()
  const prov = toProvinceCode(params.origin.province)
  const cat = CATEGORY_CODE[params.category] ?? 'OT'
  const prefix = `YM-${year}-${prov}-${cat}-`
  const all = await listBatches()
  /** 在同一年同省同类别内累加 */
  const same = all.filter((b) => b.batchNo.startsWith(prefix))
  return `${prefix}${pad4(same.length + 1)}`
}

export type NewBatchInput = {
  herbName: string
  category: HerbCategory
  growerId: string
  growerName: string
  plantingStartDate: string
  origin: HerbOrigin
  environment?: string
  coverImageUrl?: string
  description?: string
  /** 创建人，默认管理员演示账号 */
  createdBy?: string
  createdByRole?: 'admin' | 'grower'
  /** 第一版默认 approved，后续若做种植商提交可改为 pending */
  auditStatus?: AuditStatus
  /** 默认 planting */
  stage?: Stage
  /** 默认 normal */
  riskLevel?: RiskLevel
}

function nowDisplay(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** 新建批次：自动生成 id / batchNo / traceCode / 建档事件 */
export async function addBatch(input: NewBatchInput): Promise<HerbBatch> {
  const traceCode = await generateNextTraceCode()
  const batchNo = await generateNextBatchNo({ origin: input.origin, category: input.category })
  const createdAt = nowDisplay()

  const batch: HerbBatch = {
    id: `hb-${Date.now()}-${randomSuffix()}`,
    batchNo,
    traceCode,
    herbName: input.herbName,
    category: input.category,
    growerId: input.growerId,
    growerName: input.growerName,
    plantingStartDate: input.plantingStartDate,
    origin: input.origin,
    environment: input.environment,
    coverImageUrl: input.coverImageUrl,
    description: input.description,
    stage: input.stage ?? 'planting',
    auditStatus: input.auditStatus ?? 'approved',
    riskLevel: input.riskLevel ?? 'normal',
    createdAt,
    createdBy: input.createdBy ?? 'admin-lijialin',
    createdByRole: input.createdByRole ?? 'admin',
    updatedAt: createdAt,
    events: [
      {
        id: `ev-${Date.now()}-1`,
        type: 'create',
        title: '批次建档',
        description: `由 ${input.createdByRole === 'grower' ? '种植商' : '管理员'} 创建批次，关联 ${input.growerName}。`,
        occurredAt: createdAt,
        operatorName: input.createdByRole === 'grower' ? input.growerName : '管理员',
        operatorRole: input.createdByRole ?? 'admin',
      },
    ],
  }

  const ov = readOverrides()
  ov.additions = [batch, ...ov.additions]
  writeOverrides(ov)

  return batch
}

/** 更新批次（写入覆盖层；不会真的改样例 JSON） */
export async function updateBatch(id: string, patch: Partial<HerbBatch>): Promise<HerbBatch> {
  const target = await getById(id)
  if (!target) throw new Error(`批次不存在：${id}`)

  const ov = readOverrides()

  /** 用户新增批次：直接改 additions */
  const addedIdx = ov.additions.findIndex((b) => b.id === id)
  if (addedIdx >= 0) {
    ov.additions[addedIdx] = mergeOne(ov.additions[addedIdx]!, { ...patch, updatedAt: nowDisplay() })
    writeOverrides(ov)
    return ov.additions[addedIdx]!
  }

  /** 基础样例：记录到 updates 中 */
  const prev = ov.updates[id] ?? {}
  ov.updates[id] = { ...prev, ...patch, updatedAt: nowDisplay() }
  writeOverrides(ov)

  return mergeOne(target, ov.updates[id]!)
}

/** 仅更改审核状态（管理员审核 UI 用） */
export async function setAuditStatus(id: string, status: AuditStatus): Promise<HerbBatch> {
  return updateBatch(id, { auditStatus: status })
}

export type NewBatchEventInput = Omit<BatchEvent, 'id'> & { id?: string }

/** 向批次追加链路事件（种植日志、阶段变更等） */
export async function addBatchEvent(batchId: string, input: NewBatchEventInput): Promise<HerbBatch> {
  const batch = await getById(batchId)
  if (!batch) throw new Error(`批次不存在：${batchId}`)

  const event: BatchEvent = {
    id: input.id ?? `ev-${Date.now()}-${randomSuffix()}`,
    type: input.type,
    title: input.title,
    description: input.description,
    occurredAt: input.occurredAt,
    operatorName: input.operatorName,
    operatorRole: input.operatorRole,
    scopes: input.scopes,
    fromStage: input.fromStage,
    toStage: input.toStage,
    attachments: input.attachments,
  }

  return updateBatch(batchId, { events: [...batch.events, event] })
}

/**
 * 阶段流转的合法下一阶段
 * planting → harvested → processing → warehousing → shipped → sold
 * 任意阶段都允许「驳回后回到 planting」由审核路径处理
 */
export const STAGE_NEXT: Record<Stage, Stage | null> = {
  planting: 'harvested',
  harvested: 'processing',
  processing: 'warehousing',
  warehousing: 'shipped',
  shipped: 'sold',
  sold: null,
}

/** 通用阶段流转：写入 toStage 事件 + 更新 batch.stage */
export async function setStage(
  batchId: string,
  toStage: Stage,
  options: { operatorName: string; operatorRole: BatchEvent['operatorRole']; note?: string },
): Promise<HerbBatch> {
  const batch = await getById(batchId)
  if (!batch) throw new Error(`批次不存在：${batchId}`)

  if (batch.stage === toStage) {
    throw new Error(`批次已处于「${STAGE_LABEL[toStage]}」，无需变更`)
  }

  return addBatchEvent(batchId, {
    type: 'stageChange',
    title: `阶段变更：${STAGE_LABEL[batch.stage]} → ${STAGE_LABEL[toStage]}`,
    description: options.note,
    occurredAt: nowDisplay(),
    operatorName: options.operatorName,
    operatorRole: options.operatorRole,
    fromStage: batch.stage,
    toStage,
  }).then(() => updateBatch(batchId, { stage: toStage }))
}

export type HarvestInput = {
  /** 采收日期 YYYY-MM-DD */
  harvestDate: string
  /** 采收数量（kg），必填 */
  yieldKg: number
  /** 采收地块，可选 */
  plotArea?: string
  /** 采收人员，可选，默认登录人 */
  harvesterName?: string
  /** 备注，可选 */
  note?: string
  /** 现场照片，最多 4 张，base64 */
  photos?: { name: string; url: string }[]
}

/**
 * 采收登记：写入一条 harvest 事件 + 流转阶段到 harvested
 * 业务约束：仅 planting 阶段可触发；驳回状态不可触发。
 */
export async function recordHarvest(
  batchId: string,
  input: HarvestInput,
  operator: { userId: string; displayName: string; growerId?: string; growerName?: string },
): Promise<HerbBatch> {
  const batch = await getById(batchId)
  if (!batch) throw new Error(`批次不存在：${batchId}`)

  if (batch.auditStatus === 'rejected') {
    throw new Error('该批次已被驳回，暂不能采收')
  }
  if (batch.stage !== 'planting') {
    throw new Error(`仅「种植中」批次可采收，当前阶段：${STAGE_LABEL[batch.stage]}`)
  }
  if (!Number.isFinite(input.yieldKg) || input.yieldKg <= 0) {
    throw new Error('请填写有效的采收数量（大于 0）')
  }
  if (!input.harvestDate) {
    throw new Error('请选择采收日期')
  }

  const photoCount = Math.min(input.photos?.length ?? 0, 4)
  const photos = (input.photos ?? []).slice(0, photoCount)

  const description =
    `采收日期：${input.harvestDate}\n` +
    `采收数量：${input.yieldKg.toFixed(2)} kg` +
    (input.plotArea ? `\n采收地块：${input.plotArea}` : '') +
    (input.harvesterName ? `\n采收人员：${input.harvesterName}` : '') +
    (input.note ? `\n备注：${input.note}` : '') +
    (photoCount > 0 ? `\n现场照片：${photoCount} 张` : '')

  /** 先写 harvest 事件，再切阶段；任一失败回滚已写入的内容（用 stage 不动实现简化） */
  await addBatchEvent(batchId, {
    type: 'note',
    title: '采收登记',
    description,
    occurredAt: input.harvestDate,
    operatorName: operator.displayName,
    operatorRole: 'grower',
    attachments: photos.length > 0 ? photos : undefined,
  })

  return setStage(batchId, 'harvested', {
    operatorName: operator.displayName,
    operatorRole: 'grower',
    note: `采收完成：${input.yieldKg.toFixed(2)} kg`,
  })
}

/** 重置所有本地覆盖（开发时清空） */
export function resetOverrides(): void {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('herb-changed'))
}

/**
 * 监听批次数据变化（同标签页内 add/update/reset 都会触发）
 * 不同标签页间会通过 storage 事件传播
 */
export function subscribeHerbChanged(listener: () => void): () => void {
  const onChange = () => listener()
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener()
  }
  window.addEventListener('herb-changed', onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('herb-changed', onChange)
    window.removeEventListener('storage', onStorage)
  }
}
