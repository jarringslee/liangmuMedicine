/**
 * 药材批次数据访问层
 *
 * - 基础样例来自 `/public/data/herb-batches.json`
 * - 用户在前端新增/修改的批次以「覆盖层」形式写入 localStorage
 * - 所有方法均为 async，后续可无痛替换为真实 API
 */

import type { AuditStatus, HerbBatch, HerbCategory, HerbOrigin, RiskLevel, Stage } from '../types/herb'

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

/** 极简：基于产地省份与药材名生成 batchNo 风格的业务编号 */
export async function generateNextBatchNo(params: {
  origin: HerbOrigin
  herbName: string
}): Promise<string> {
  const year = currentYear()
  const provinceCode = params.origin.province.slice(0, 1).toUpperCase() + 'M'
  const herbCode = params.herbName.slice(0, 2).toUpperCase()
  const all = await listBatches()
  /** 在同一年同省同药材内累加 */
  const same = all.filter((b) =>
    b.batchNo.startsWith(`YM-${year}-${provinceCode}-${herbCode}-`),
  )
  return `YM-${year}-${provinceCode}-${herbCode}-${pad4(same.length + 1)}`
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
  const batchNo = await generateNextBatchNo({ origin: input.origin, herbName: input.herbName })
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
