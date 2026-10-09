/** 显式执行：npx tsx tests/chat.database-smoke.ts [--browser]
 * 仅允许本机开发数据库；随机临时数据在 finally 精确清理，不运行 seed/reset。
 * --browser 暂留两名临时账号供 UI 验收，按 Enter 或 10 分钟后清理。
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { env } from '../src/config/env.js'
import { prisma } from '../src/lib/prisma.js'
import { createAuthService } from '../src/services/auth.js'
import { createChatService } from '../src/services/chat.js'
import { createNotificationChanges } from '../src/services/notificationChanges.js'

const target = new URL(env.DATABASE_URL)
assert.ok(env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname),
  '烟测仅允许本机非生产数据库')
const marker = `chat-smoke-${randomUUID().slice(0, 8)}`
const password = 'knife20-local-test-only'
const ids = (name: string) => `${marker}-${name}`
const userIds: string[] = [], orgIds: string[] = [], batchIds: string[] = []
const auth = createAuthService(), chat = createChatService(prisma, createNotificationChanges())
const before = { users: await prisma.user.count(), orgs: await prisma.organization.count(),
  batches: await prisma.herbBatch.count(), chats: await prisma.chatConversation.count(),
  messages: await prisma.chatMessage.count(), notifications: await prisma.notification.count() }
try {
  for (const [name, type] of [['platform', 'platform'], ['buyer', 'buyer'], ['grower', 'grower'],
    ['other-grower', 'grower'], ['processor', 'processor'], ['other-processor', 'processor']] as const) {
    const id = ids(`org-${name}`)
    await prisma.organization.create({ data: { id, code: id, name: `临时验收-${name}`, type } }); orgIds.push(id)
  }
  const passwordHash = await hash(password, 4)
  for (const [name, role, org, status] of [
    ['admin', 'admin', 'platform', 'active'], ['disabled', 'admin', 'platform', 'disabled'],
    ['buyer', 'buyer', 'buyer', 'active'], ['buyer-peer', 'buyer', 'buyer', 'active'],
    ['grower', 'grower', 'grower', 'active'], ['grower-peer', 'grower', 'grower', 'active'],
    ['other-grower', 'grower', 'other-grower', 'active'], ['processor', 'processor', 'processor', 'active'],
    ['other-processor', 'processor', 'other-processor', 'active'],
  ] as const) {
    const id = ids(name)
    await prisma.user.create({ data: { id, username: id, email: `${id}@example.invalid`, passwordHash,
      displayName: `临时验收-${name}`, role, status, organizationId: ids(`org-${org}`) } }); userIds.push(id)
  }
  const batchId = ids('batch')
  await prisma.herbBatch.create({ data: { id: batchId, batchNo: batchId, traceCode: batchId, herbName: '验收用丹参',
    category: 'root', plantingStartDate: new Date('2026-10-01T00:00:00Z'), origin: { province: '陕西', city: '测试' },
    growerOrganizationId: ids('org-grower'), processorOrganizationId: ids('org-processor'),
    createdById: ids('grower'), stage: 'processing', auditStatus: 'approved' } }); batchIds.push(batchId)
  const admin = await auth.currentUser(ids('admin')), buyer = await auth.currentUser(ids('buyer')),
    grower = await auth.currentUser(ids('grower')), processor = await auth.currentUser(ids('processor')),
    outsider = await auth.currentUser(ids('other-grower'))
  const visible = async (user: typeof admin) => (await chat.contacts(user, marker)).items.map((u) => u.id).sort()
  assert.deepEqual(await visible(buyer), [admin.id])
  assert.deepEqual(await visible(grower), [admin.id, ids('grower-peer'), processor.id].sort())
  assert.deepEqual(await visible(processor), [admin.id, grower.id, ids('grower-peer')].sort())
  await assert.rejects(chat.open(buyer, grower.id), { status: 404 })
  await assert.rejects(chat.open(grower, ids('other-processor')), { status: 404 })
  const [first, other] = await Promise.all([chat.open(grower, processor.id), chat.open(processor, grower.id)])
  assert.equal(first.id, other.id)
  const customer = await chat.open(buyer, admin.id)
  await assert.rejects(chat.history(outsider, first.id), { status: 404 })
  const uuid = randomUUID(), input = { clientMessageId: uuid, content: '并发去重测试' }
  const duplicate = await Promise.all([chat.send(grower, first.id, input), chat.send(grower, first.id, input)])
  assert.equal(duplicate[0].item.id, duplicate[1].item.id)
  await assert.rejects(chat.send(grower, customer.id, input), { status: 404 })
  await assert.rejects(chat.send(grower, first.id, { ...input, content: '重复编号改原文' }), { status: 409 })
  const parallel = await Promise.all(Array.from({ length: 6 }, (_, i) => chat.send(processor, first.id,
    { clientMessageId: randomUUID(), content: `并发消息 ${i}` })))
  assert.equal(new Set(parallel.map((r) => r.item.sequence)).size, 6)
  assert.equal((await chat.conversations(grower)).items.find((c) => c.id === first.id)?.unreadCount, 6)
  const latest = (await chat.history(grower, first.id)).items.at(-1)!.sequence
  await Promise.all([chat.markRead(grower, first.id, latest), chat.markRead(grower, first.id, 1)])
  assert.equal((await chat.conversations(grower)).items.find((c) => c.id === first.id)?.unreadCount, 0)
  await assert.rejects(chat.markRead(grower, first.id, latest + 1), { status: 400 })
  for (let i = 0; i < 37; i++) await chat.send(processor, first.id,
    { clientMessageId: randomUUID(), content: `历史分页 ${i}` })
  const history = await chat.history(grower, first.id)
  assert.equal(history.items.length, 40); assert.ok(history.nextBefore)
  const older = await chat.history(grower, first.id, history.nextBefore!)
  assert.equal(older.items.length, 4)
  assert.ok(older.items.at(-1)!.sequence < history.items[0].sequence)
  assert.equal(new Set([...older.items, ...history.items].map((i) => i.id)).size, 44)
  // 新服务实例仍读取相同记录，不依赖某个进程的内存数组。
  assert.deepEqual(await createChatService().history(grower, first.id), history)
  await prisma.herbBatch.update({ where: { id: batchId }, data: { processorOrganizationId: null } })
  assert.ok(!(await visible(grower)).includes(processor.id))
  assert.equal((await chat.conversations(grower)).items.some((c) => c.id === first.id), false)
  await assert.rejects(chat.history(grower, first.id), { status: 404 })
  await assert.rejects(chat.send(grower, first.id, { clientMessageId: randomUUID(), content: '撤权后发送' }), { status: 404 })
  await assert.rejects(chat.markRead(grower, first.id, 1), { status: 404 })
  await prisma.herbBatch.update({ where: { id: batchId }, data: { processorOrganizationId: ids('org-processor') } })
  await chat.send(buyer, customer.id, { clientMessageId: randomUUID(), content: '临时采购商：这批药材的资料在哪里查看？' })
  await chat.send(admin, customer.id, { clientMessageId: randomUUID(), content: '临时客服：可以从药材列表、溯源码或扫码进入详情。' })
  console.log('PASS: 数据库联系人隔离、双向/并发创建、UUID 幂等、并发顺序、未读、44 条历史分页、实例恢复与撤权 404')
  if (process.argv.includes('--browser')) {
    console.log(JSON.stringify({ temporaryAdmin: admin.username, temporaryBuyer: buyer.username,
      temporaryGrower: grower.username, temporaryProcessor: processor.username, password, marker }))
    console.log('临时账号供浏览器验收；按 Enter / Ctrl+C 或 10 分钟后精确清理。')
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 10 * 60_000)
      const done = () => { clearTimeout(timer); resolve() }
      process.stdin.once('data', done); process.once('SIGINT', done); process.stdin.resume()
    })
    process.stdin.pause()
  }
} finally {
  // 只匹配本轮随机生成的精确主键；先删会话，才能解除消息 sender 外键。
  await prisma.chatConversation.deleteMany({ where: { participants: { some: { userId: { in: userIds } } } } })
  await prisma.herbBatch.deleteMany({ where: { id: { in: batchIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  const after = { users: await prisma.user.count(), orgs: await prisma.organization.count(),
    batches: await prisma.herbBatch.count(), chats: await prisma.chatConversation.count(),
    messages: await prisma.chatMessage.count(), notifications: await prisma.notification.count() }
  console.log('临时记录已精确清理', { before, after })
  await prisma.$disconnect()
}
