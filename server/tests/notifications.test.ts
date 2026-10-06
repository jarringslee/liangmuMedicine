import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import type { Prisma } from '@prisma/client'
import express from 'express'
import { SignJWT } from 'jose'
import { io as connect, type Socket } from 'socket.io-client'
import type { AuthService, AuthUser } from '../src/services/auth.js'
import type { BatchDetailRecord } from '../src/services/batches.js'
import type { NotificationRecord, NotificationRepository } from '../src/services/notifications.js'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-notification-secret-0123456789abcdef'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
const { createNotificationChanges } = await import('../src/services/notificationChanges.js')
const { createNotificationService } = await import('../src/services/notifications.js')
const { createSubmittedBatch } = await import('../src/services/batches.js')
const { createNotificationRouter } = await import('../src/routes/notifications.js')
const { attachNotificationRealtime } = await import('../src/realtime/notifications.js')
const { HttpError, errorHandler } = await import('../src/middleware/error.js')
const { signAccessToken } = await import('../src/lib/token.js')

const admin = (id = 'admin-a'): AuthUser => ({ id, username: id, email: `${id}@example.test`, displayName: id,
  role: 'admin', organizationId: null, organization: null })
const record: NotificationRecord = { id: 'notice-1', type: 'batchSubmitted', batchId: 'batch-1',
  title: '新批次待审核', content: '请审核丹参', readAt: null, createdAt: new Date('2026-10-05T00:00:00Z') }
function setup() {
  const changes = createNotificationChanges()
  const messages = new Map<string, NotificationRecord[]>([['admin-a', [structuredClone(record)]], ['admin-b', []]])
  const repository: NotificationRepository = {
    async list(id, query) {
      const all = messages.get(id) ?? []
      const filtered = all.filter((item) => query.status === 'all' || (query.status === 'read') === (item.readAt !== null))
      return { items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
        total: filtered.length, unreadCount: all.filter((item) => !item.readAt).length }
    },
    async markRead(id, messageId) {
      const item = messages.get(id)?.find((item) => item.id === messageId)
      if (!item) return null
      item.readAt ??= new Date()
      return structuredClone(item)
    },
  }
  let disabled = false
  const auth: AuthService = {
    async login() { return admin() },
    async currentUser(id) {
      if (disabled) throw new HttpError(403, 'ACCOUNT_DISABLED', '账号已禁用')
      return id === 'grower' ? { ...admin(id), role: 'grower' } : admin(id)
    },
  }
  return { changes, messages, service: createNotificationService(repository, changes), auth,
    disable: () => { disabled = true } }
}
async function listen(server: Server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
function event<T = unknown>(socket: Socket, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(name, handler); reject(new Error(`Timed out: ${name}`)) }, 2500)
    function handler(value: T) { clearTimeout(timer); resolve(value) }
    socket.once(name, handler)
  })
}
function client(url: string, token: string, origin = 'http://localhost:5173') {
  return connect(url, { autoConnect: false, reconnection: false, transports: ['websocket'],
    auth: { token }, extraHeaders: { Origin: origin } })
}

test('通知服务按收件人隔离，未读数不受筛选分页影响；越权和未知均 404', async () => {
  const { service } = setup()
  const page = await service.list(admin(), { page: 1, pageSize: 10, status: 'read' })
  assert.equal(page.total, 0)
  assert.equal(page.unreadCount, 1)
  assert.equal((await service.list(admin('admin-b'), { page: 1, pageSize: 10, status: 'all' })).total, 0)
  for (const id of ['notice-1', 'unknown']) await assert.rejects(service.markRead(admin('admin-b'), id), { status: 404 })
  await assert.rejects(service.list({ ...admin(), role: 'buyer' }, { page: 1, pageSize: 10, status: 'all' }), { status: 403 })
})

test('标记已读幂等，只通知当前收件人，数据库失败不发送提示', async () => {
  const { service, changes } = setup()
  const published: string[][] = []
  changes.subscribe((ids) => published.push(ids))
  const first = await service.markRead(admin(), 'notice-1')
  const second = await service.markRead(admin(), 'notice-1')
  assert.equal(first.readAt?.getTime(), second.readAt?.getTime())
  assert.deepEqual(published, [['admin-a'], ['admin-a']])
  assert.equal((await service.list(admin(), { page: 1, pageSize: 10, status: 'all' })).unreadCount, 0)
  await assert.rejects(service.markRead(admin(), 'missing'), { status: 404 })
  assert.equal(published.length, 2)
})

test('通知 HTTP 认证、角色、严格查询/请求体和已读响应契约', async () => {
  const { service, auth } = setup()
  const app = express(); app.use(express.json())
  app.use('/api/notifications', createNotificationRouter(auth, service)); app.use(errorHandler)
  const server = createServer(app), url = await listen(server)
  try {
    assert.equal((await fetch(`${url}/api/notifications`)).status, 401)
    const headers = { Authorization: `Bearer ${await signAccessToken('admin-a')}`, 'Content-Type': 'application/json' }
    assert.equal((await fetch(`${url}/api/notifications`, { headers: { Authorization: `Bearer ${await signAccessToken('grower')}` } })).status, 403)
    for (const query of ['?recipientId=admin-b', '?page=0', '?pageSize=101', '?status=chat', '?page=1&page=2']) {
      assert.equal((await fetch(`${url}/api/notifications${query}`, { headers })).status, 400)
    }
    const response = await fetch(`${url}/api/notifications`, { headers })
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    const page = await response.json()
    assert.equal(page.items[0].id, 'notice-1'); assert.equal(page.unreadCount, 1)
    assert.equal('recipientId' in page.items[0], false)
    assert.equal((await fetch(`${url}/api/notifications/notice-1/read`, { method: 'PATCH', headers, body: '{"recipientId":"admin-b"}' })).status, 400)
    assert.equal((await fetch(`${url}/api/notifications/missing/read`, { method: 'PATCH', headers, body: '{}' })).status, 404)
    const read = await (await fetch(`${url}/api/notifications/notice-1/read`, { method: 'PATCH', headers, body: '{}' })).json()
    assert.ok(read.item.readAt)
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())) }
})

test('建档事务内生成有效管理员通知，提交前不推送；失败不推送', async () => {
  const input = { herbName: '丹参', category: 'root' as const, plantingStartDate: '2026-10-05',
    plantingStartDateValue: new Date(), origin: { province: '陕西省', city: '西安市' },
    batchNo: 'YM-TEST', traceCode: 'YM-TRACE-TEST', growerOrganizationId: 'grower-org', creatorId: 'grower', creatorName: '种植商' }
  const batch = { id: 'batch-1', batchNo: 'YM-TEST' } as BatchDetailRecord
  let committed = false, published = 0, created = 0
  const tx = {
    herbBatch: { async create(args: { data: { events: { create: { operatorRole: string } } } }) {
      assert.equal(args.data.events.create.operatorRole, 'grower'); return batch
    } },
    user: { async findMany(args: { where: { role: string; status: string; OR: unknown[] } }) {
      assert.equal(args.where.role, 'admin'); assert.equal(args.where.status, 'active'); assert.equal(args.where.OR.length, 2)
      return [{ id: 'admin-a' }, { id: 'admin-b' }]
    } },
    notification: { async createMany(args: { data: { recipientId: string; batchId: string; type: string }[] }) {
      created++; assert.equal(published, 0)
      assert.deepEqual(args.data.map((item) => item.recipientId), ['admin-a', 'admin-b'])
      assert.ok(args.data.every((item) => item.batchId === 'batch-1' && item.type === 'batchSubmitted'))
    } },
  } as unknown as Prisma.TransactionClient
  const result = await createSubmittedBatch(input, async (work) => {
    const result = await work(tx); assert.equal(published, 0); committed = true; return result
  }, (ids) => { assert.equal(committed, true); assert.deepEqual(ids, ['admin-a', 'admin-b']); published++ })
  assert.equal(result, batch); assert.equal(created, 1); assert.equal(published, 1)
  await assert.rejects(createSubmittedBatch(input, async () => { throw new Error('rollback') }, () => { published++ }))
  assert.equal(published, 1)
})

test('提示总线去重、取消订阅，监听器异常不会影响已提交业务', () => {
  const changes = createNotificationChanges(); let calls = 0
  const unsubscribe = changes.subscribe((ids) => { calls++; assert.deepEqual(ids, ['a']) })
  changes.publish(['a', 'a']); unsubscribe(); changes.publish(['a']); assert.equal(calls, 1)
  const warn = console.warn; console.warn = () => undefined
  try { changes.subscribe(() => { throw new Error('transport') }); assert.doesNotThrow(() => changes.publish(['a'])) }
  finally { console.warn = warn }
})

test('真实 Socket 握手验签/角色/Origin，不允许前端冒领用户房间', async () => {
  const { auth, changes } = setup(), server = createServer()
  const io = attachNotificationRealtime(server, auth, changes), url = await listen(server)
  const sockets: Socket[] = []
  try {
    for (const input of [
      { token: 'invalid' }, { token: await signAccessToken('grower') },
      { token: await signAccessToken('admin-a'), recipientId: 'admin-b' },
    ]) {
      const socket = client(url, input.token); sockets.push(socket); socket.auth = input
      const rejected = event(socket, 'connect_error'); socket.connect(); await rejected
      assert.equal(socket.connected, false)
    }
    const evil = client(url, await signAccessToken('admin-a'), 'https://evil.example'); sockets.push(evil)
    const rejected = event(evil, 'connect_error'); evil.connect(); await rejected
    assert.equal(evil.connected, false)
  } finally { sockets.forEach((socket) => socket.disconnect()); await new Promise<void>((resolve) => io.close(() => resolve())) }
})

test('提示只进入本用户房间/多标签，断线未收到的消息可重连后 REST 补查', async () => {
  const { auth, service, changes, messages } = setup(), server = createServer()
  const io = attachNotificationRealtime(server, auth, changes), url = await listen(server)
  const a = client(url, await signAccessToken('admin-a')), a2 = client(url, await signAccessToken('admin-a')),
    b = client(url, await signAccessToken('admin-b'))
  let receivedByB = 0; b.on('notifications:changed', () => { receivedByB++ })
  try {
    for (const socket of [a, a2, b]) { const connected = event(socket, 'connect'); socket.connect(); await connected }
    a.emit('join', 'notification-user:admin-b') // 服务端没有此业务入口。
    const first = event(a, 'notifications:changed'), second = event(a2, 'notifications:changed')
    changes.publish(['admin-a']); await Promise.all([first, second])
    await new Promise((resolve) => setTimeout(resolve, 30)); assert.equal(receivedByB, 0)
    a.disconnect(); a2.disconnect()
    messages.get('admin-a')!.unshift({ ...record, id: 'offline-message' }); changes.publish(['admin-a'])
    const connected = event(a, 'connect'); a.connect(); await connected
    const page = await service.list(admin(), { page: 1, pageSize: 10, status: 'all' })
    assert.equal(page.items[0].id, 'offline-message'); assert.equal(page.unreadCount, 2)
  } finally { [a, a2, b].forEach((socket) => socket.disconnect()); await new Promise<void>((resolve) => io.close(() => resolve())) }
})

test('长连接账号停用和 JWT 到期后主动断开，不仅依赖连接时鉴权', async () => {
  const { auth, changes, disable } = setup(), server = createServer()
  const io = attachNotificationRealtime(server, auth, changes, 20), url = await listen(server)
  const expiring = await new SignJWT({}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('admin-a').setIssuer('liangmuMedicine').setAudience('liangmuMedicine-web')
    .setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + 2)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET))
  const a = client(url, expiring), b = client(url, await signAccessToken('admin-b'))
  try {
    const connected = event(a, 'connect'); a.connect(); await connected
    const expired = event(a, 'session:invalid'), disconnected = event(a, 'disconnect')
    await Promise.all([expired, disconnected]); assert.equal(a.connected, false)
    const second = event(b, 'connect'); b.connect(); await second
    const disabled = event(b, 'session:invalid'), gone = event(b, 'disconnect'); disable()
    await Promise.all([disabled, gone]); assert.equal(b.connected, false)
  } finally { a.disconnect(); b.disconnect(); await new Promise<void>((resolve) => io.close(() => resolve())) }
})
