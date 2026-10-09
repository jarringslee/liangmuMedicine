import type { AuthSession } from '../types/auth'
import type { BatchEvent, DispatchRecipient, HerbBatch } from '../types/herb'
import { ApiError } from './api'
import { getAuthSnapshot } from './auth'
import { getById, updateBatch } from './herbStorage'

/** 网络响应是 unknown：校验最小契约、去除额外字段，不把账号资料带到选项。 */
export function parseDispatchRecipients(value: unknown): DispatchRecipient[] {
  const invalid = () => new ApiError(0, 'INVALID_RESPONSE', '采购组织数据格式不正确')
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) throw invalid()
  const ids = new Set<string>()
  return value.items.map((item: unknown) => {
    if (!item || typeof item !== 'object' || !('id' in item) || !('name' in item) ||
      typeof item.id !== 'string' || !item.id.trim() || item.id.length > 100 ||
      typeof item.name !== 'string' || !item.name.trim() || ids.has(item.id)) throw invalid()
    ids.add(item.id)
    return { id: item.id, name: item.name }
  })
}

function requireDemoRole(role: AuthSession['role']) {
  const { status, session } = getAuthSnapshot()
  if (status !== 'authenticated' || !session || session.role !== role) {
    throw new ApiError(403, 'FORBIDDEN', '当前演示身份无权执行此操作')
  }
  return session
}
function assertSameSession(session: AuthSession) {
  const current = getAuthSnapshot()
  if (current.status !== 'authenticated' || current.session !== session) {
    throw new DOMException('登录身份已变化', 'AbortError')
  }
}

/** 静态账号仅用于现有离线兜底；不让 demo 身份访问真实组织/API。 */
export async function listDemoDispatchRecipients(signal?: AbortSignal): Promise<DispatchRecipient[]> {
  signal?.throwIfAborted()
  const actor = requireDemoRole('admin')
  const { staticAccounts } = await import('../mock/user/credentials')
  signal?.throwIfAborted(); assertSameSession(actor)
  return [...new Map(staticAccounts.filter((account) => account.role === 'buyer')
    .map((account) => [account.organizationId, { id: account.organizationId, name: account.organizationName }])).values()]
}

/** 展示能力从当前演示身份和归属推导，不信任 localStorage 中残留的 true。 */
export function withDemoReceiptPermission(batch: HerbBatch): HerbBatch & { canConfirmReceipt: boolean } {
  const { session } = getAuthSnapshot()
  const owns = session?.role === 'buyer' && !!session.organizationId && session.organizationId === batch.buyerId
  const showRecipient = session?.role === 'admin' || owns
  return { ...batch, buyerId: showRecipient ? batch.buyerId : undefined,
    buyerName: showRecipient ? batch.buyerName : undefined,
    canConfirmReceipt: owns && batch.auditStatus === 'approved' && batch.stage === 'shipped' }
}

function transition(batch: HerbBatch, toStage: 'shipped' | 'sold', actor: AuthSession, recipient?: DispatchRecipient) {
  const at = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date())
  const event: BatchEvent = { id: crypto.randomUUID(), type: 'stageChange',
    title: toStage === 'shipped' ? '阶段变更：仓储 → 已出库' : '阶段变更：已出库 → 已售',
    description: toStage === 'shipped' ? '管理员已确认出库，批次进入运输环节。' : '采购商已确认收货，批次完成本次流转。',
    occurredAt: at, operatorName: actor.displayName, operatorRole: actor.role, scopes: ['public'],
    fromStage: batch.stage, toStage }
  const patch: Partial<HerbBatch> = { stage: toStage, events: [...batch.events, event],
    ...(recipient ? { buyerId: recipient.id, buyerName: recipient.name } : {}) }
  // 一次覆盖层写入同时更新归属、阶段与事件；这不是数据库事务或跨标签安全隔离。
  return updateBatch(batch.id, patch).then(withDemoReceiptPermission)
}

export async function dispatchDemoBatch(batchId: string, buyerOrganizationId: string): Promise<HerbBatch> {
  const actor = requireDemoRole('admin')
  const recipients = await listDemoDispatchRecipients()
  const recipient = recipients.find((item) => item.id === buyerOrganizationId)
  if (!recipient) throw new ApiError(400, 'INVALID_DISPATCH_RECIPIENT', '请选择有效的采购组织')
  const batch = await getById(batchId)
  assertSameSession(actor)
  if (!batch) throw new ApiError(404, 'BATCH_NOT_FOUND', '药材批次不存在或无权查看')
  if (batch.auditStatus !== 'approved' || batch.stage !== 'warehousing' || batch.buyerId) {
    throw new ApiError(409, 'INVALID_BATCH_STAGE', '仅审核通过且未分配的仓储批次可以出库')
  }
  return transition(batch, 'shipped', actor, recipient)
}

export async function confirmDemoReceipt(batchId: string): Promise<HerbBatch> {
  const actor = requireDemoRole('buyer')
  const batch = await getById(batchId)
  assertSameSession(actor)
  if (!batch || !actor.organizationId || batch.buyerId !== actor.organizationId) {
    throw new ApiError(404, 'BATCH_NOT_FOUND', '药材批次不存在或无权查看')
  }
  if (batch.auditStatus !== 'approved' || batch.stage !== 'shipped') {
    throw new ApiError(409, 'INVALID_BATCH_STAGE', '仅审核通过的已出库批次可以收货')
  }
  return transition(batch, 'sold', actor)
}
