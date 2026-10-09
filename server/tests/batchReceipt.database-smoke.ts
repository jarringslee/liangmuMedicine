/** 显式执行：npx tsx tests/batchReceipt.database-smoke.ts
 * 仅本机非生产数据库；随机临时记录在 finally 按精确 ID 清理，不运行 seed/reset。
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { env } from '../src/config/env.js'
import { prisma } from '../src/lib/prisma.js'
import { createAuthService } from '../src/services/auth.js'
import { createBatchService } from '../src/services/batches.js'

const target = new URL(env.DATABASE_URL)
assert.ok(env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
  ['5432', ''].includes(target.port) && target.pathname === '/liangmu_medicine',
  '烟测只允许已核对的本机 liangmu_medicine 开发数据库')
const marker = `receipt-smoke-${randomUUID().slice(0, 8)}`
const id = (name: string) => `${marker}-${name}`
const userIds: string[] = [], orgIds: string[] = [], batchIds: string[] = []
const auth = createAuthService(), service = createBatchService()
const existing = () => prisma.herbBatch.findMany({
  where: { id: { notIn: batchIds } }, orderBy: { id: 'asc' },
  select: { id: true, stage: true, version: true, buyerOrganizationId: true },
})
const before = await existing()
try {
  for (const [name, type, enabled] of [
    ['platform', 'platform', true], ['grower', 'grower', true], ['buyer-a', 'buyer', true],
    ['buyer-b', 'buyer', true], ['disabled-buyer', 'buyer', false], ['empty-buyer', 'buyer', true],
  ] as const) {
    const orgId = id(`org-${name}`)
    await prisma.organization.create({ data: { id: orgId, code: orgId, name: `临时验收-${name}`, type, enabled } })
    orgIds.push(orgId)
  }
  const passwordHash = await hash(randomUUID(), 4)
  for (const [name, role, org] of [
    ['admin', 'admin', 'platform'], ['grower', 'grower', 'grower'],
    ['buyer-a', 'buyer', 'buyer-a'], ['buyer-b', 'buyer', 'buyer-b'],
    ['disabled-buyer', 'buyer', 'disabled-buyer'],
  ] as const) {
    const userId = id(name)
    await prisma.user.create({ data: { id: userId, username: userId, email: `${userId}@example.invalid`,
      displayName: `临时验收-${name}`, passwordHash, role, organizationId: id(`org-${org}`) } })
    userIds.push(userId)
  }
  for (const [name, stage] of [['flow', 'warehousing'], ['legacy', 'shipped']] as const) {
    const batchId = id(`batch-${name}`)
    await prisma.herbBatch.create({ data: { id: batchId, batchNo: batchId, traceCode: batchId,
      herbName: '临时验收黄芪', category: 'root', plantingStartDate: new Date('2026-10-01T00:00:00Z'),
      origin: { province: '测试省', city: '测试市' }, growerOrganizationId: id('org-grower'),
      createdById: id('grower'), auditStatus: 'approved', stage } })
    batchIds.push(batchId)
  }
  const admin = await auth.currentUser(id('admin')), buyerA = await auth.currentUser(id('buyer-a')),
    buyerB = await auth.currentUser(id('buyer-b'))
  const options = await service.dispatchRecipients(admin)
  for (const name of ['buyer-a', 'buyer-b']) assert.ok(options.items.some((item) => item.id === id(`org-${name}`)))
  for (const name of ['grower', 'platform', 'disabled-buyer', 'empty-buyer']) {
    assert.ok(!options.items.some((item) => item.id === id(`org-${name}`)))
    await assert.rejects(service.dispatch(admin, id('batch-flow'), { buyerOrganizationId: id(`org-${name}`) }),
      { status: 400, code: 'INVALID_DISPATCH_RECIPIENT' })
  }
  await assert.rejects(service.dispatchRecipients(buyerA), { status: 403 })
  await assert.rejects(service.confirmReceipt(buyerA, id('batch-legacy')), { status: 404 })

  // 并发出库只允许一个版本成功；失败方不能覆盖收货组织或多写事件。
  const dispatched = await Promise.allSettled([buyerA, buyerB].map((buyer) => service.dispatch(admin,
    id('batch-flow'), { buyerOrganizationId: buyer.organizationId! })))
  assert.equal(dispatched.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(dispatched.filter((result) => result.status === 'rejected').length, 1)
  const rejection = dispatched.find((result) => result.status === 'rejected')!
  assert.equal(rejection.reason.status, 409)
  const stored = await prisma.herbBatch.findUniqueOrThrow({ where: { id: id('batch-flow') } })
  assert.equal(stored.stage, 'shipped'); assert.equal(stored.version, 2)
  assert.equal(await prisma.batchEvent.count({ where: { batchId: stored.id } }), 1)
  const owner = stored.buyerOrganizationId === buyerA.organizationId ? buyerA : buyerB
  const outsider = owner.id === buyerA.id ? buyerB : buyerA
  assert.equal((await service.detail(owner, stored.id)).canConfirmReceipt, true)
  const otherView = await service.detail(outsider, stored.id)
  assert.equal(otherView.canConfirmReceipt, false); assert.equal(otherView.buyerOrganization, null)
  const otherList = await service.list(outsider, { page: 1, pageSize: 100, search: marker })
  assert.equal(otherList.items.find((item) => item.id === stored.id)?.buyerOrganization, null)
  await assert.rejects(service.confirmReceipt(outsider, stored.id), { status: 404 })
  await assert.rejects(service.confirmReceipt(outsider, 'unknown-batch'), { status: 404 })

  // 停用后不能继续用旧登录对象收货；重新启用再验收并发版本保护。
  await prisma.organization.update({ where: { id: owner.organizationId! }, data: { enabled: false } })
  await assert.rejects(auth.currentUser(owner.id), { status: 403, code: 'ORGANIZATION_DISABLED' })
  await assert.rejects(service.confirmReceipt(owner, stored.id), { status: 409 })
  await prisma.organization.update({ where: { id: owner.organizationId! }, data: { enabled: true } })
  const receipts = await Promise.allSettled([service.confirmReceipt(owner, stored.id), service.confirmReceipt(owner, stored.id)])
  assert.equal(receipts.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(receipts.filter((result) => result.status === 'rejected').length, 1)
  const finished = await prisma.herbBatch.findUniqueOrThrow({ where: { id: stored.id } })
  assert.equal(finished.stage, 'sold'); assert.equal(finished.version, 3)
  assert.equal(await prisma.batchEvent.count({ where: { batchId: stored.id } }), 2)
  assert.equal((await service.detail(owner, stored.id)).canConfirmReceipt, false)
  await assert.rejects(service.confirmReceipt(owner, stored.id), { status: 409 })
  console.log('真实数据库验收通过：有效候选组织、出库归属、跨组织/历史批次拒绝、停用保护、出库/收货并发和事件一致性')
} finally {
  // 只清本次创建且已记录的 ID，绝不使用数据库清空或模糊前缀删除。
  await prisma.herbBatch.deleteMany({ where: { id: { in: batchIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  assert.equal(await prisma.herbBatch.count({ where: { id: { in: batchIds } } }), 0)
  assert.equal(await prisma.user.count({ where: { id: { in: userIds } } }), 0)
  assert.equal(await prisma.organization.count({ where: { id: { in: orgIds } } }), 0)
  assert.deepEqual(await existing(), before, '既有批次阶段、版本与采购组织不应受烟测影响')
  await prisma.$disconnect()
  console.log('临时数据已精确清理，既有批次未改变；未运行 seed/reset 或调用 AI')
}
