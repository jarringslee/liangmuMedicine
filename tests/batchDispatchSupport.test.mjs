import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

let vite, support, fixture, storage
const originalFetch = globalThis.fetch
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
const batch = { id: 'demo-warehouse', batchNo: 'YM-DEMO', traceCode: 'YM-TRACE-DEMO', herbName: '黄芪',
  category: 'root', growerId: 'grower', growerName: '种植机构', plantingStartDate: '2026-01-01',
  origin: { province: '省', city: '市' }, stage: 'warehousing', auditStatus: 'approved', riskLevel: 'normal',
  createdAt: '2026-01-01 08:00', createdBy: '种植商', createdByRole: 'grower', updatedAt: '2026-01-01 08:00', events: [] }
const admin = { userId: 'admin-fixture', role: 'admin', organizationId: 'platform', displayName: '管理员' }
const buyer = (id) => ({ userId: `buyer-${id}`, role: 'buyer', organizationId: id, displayName: '采购商' })
before(async () => {
  vite = await createServer({ cacheDir: 'node_modules/.vite-tests/batch-dispatch-support',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent',
    define: { 'import.meta.env.VITE_AUTH_MODE': JSON.stringify('demo') },
    plugins: [{ name: 'dispatch-auth-fixture', enforce: 'pre',
      resolveId(source, importer) {
        if (source === 'virtual:dispatch-auth' || (source === './auth' &&
          importer?.replaceAll('\\', '/').endsWith('/services/batchDispatchSupport.ts'))) return '\0virtual:dispatch-auth'
      },
      load(id) { if (id === '\0virtual:dispatch-auth') return `
        export const fixture = { status: 'authenticated', session: null }
        export const getAuthSnapshot = () => fixture
      ` },
    }],
  })
  fixture = (await vite.ssrLoadModule('virtual:dispatch-auth')).fixture
  support = await vite.ssrLoadModule('/src/services/batchDispatchSupport.ts')
  storage = await vite.ssrLoadModule('/src/services/herbStorage.ts')
})
beforeEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() })
  const values = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } })
  fixture.status = 'authenticated'; fixture.session = admin
  globalThis.fetch = async (url) => {
    assert.equal(url, '/data/herb-batches.json')
    return new Response(JSON.stringify({ batches: [batch, { ...batch, id: 'legacy', stage: 'shipped' }] }))
  }
})
after(async () => {
  await vite?.close(); globalThis.fetch = originalFetch
  if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage)
  else delete globalThis.localStorage
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
  else delete globalThis.window
})

test('采购组织响应校验唯一 ID/姓名，并且只重建白名单字段', () => {
  assert.deepEqual(support.parseDispatchRecipients({ items: [{ id: 'org', name: '组织', email: 'private', password: 'private' }] }),
    [{ id: 'org', name: '组织' }])
  for (const value of [null, [], {}, { items: [null] }, { items: [{ id: '', name: '组织' }] },
    { items: [{ id: 'org', name: '' }] }, { items: [{ id: 'org', name: '甲' }, { id: 'org', name: '乙' }] }]) {
    assert.throws(() => support.parseDispatchRecipients(value), { code: 'INVALID_RESPONSE' })
  }
})

test('demo 候选来自既有采购组织，最小字段/去重，无 API 调用，非管理员拒绝', async () => {
  const options = await support.listDemoDispatchRecipients()
  assert.equal(new Set(options.map((item) => item.id)).size, options.length)
  assert.ok(options.length > 0)
  for (const item of options) assert.deepEqual(Object.keys(item).sort(), ['id', 'name'])
  fixture.session = buyer(options[0].id)
  await assert.rejects(support.listDemoDispatchRecipients(), { status: 403 })
})

test('demo 出库同时写归属/阶段/事件；当前组织收货，不信任缓存残留的许可', async () => {
  const recipient = (await support.listDemoDispatchRecipients())[0]
  const shipped = await support.dispatchDemoBatch(batch.id, recipient.id)
  assert.equal(shipped.buyerId, recipient.id); assert.equal(shipped.buyerName, recipient.name)
  assert.equal(shipped.stage, 'shipped'); assert.equal(shipped.events.length, 1)
  fixture.session = buyer(recipient.id)
  assert.equal(support.withDemoReceiptPermission(shipped).canConfirmReceipt, true)
  const sold = await support.confirmDemoReceipt(batch.id)
  assert.equal(sold.stage, 'sold'); assert.equal(sold.events.length, 2)
  assert.equal(sold.canConfirmReceipt, false)
  await assert.rejects(support.confirmDemoReceipt(batch.id), { status: 409 })
  assert.equal((await storage.getById(batch.id)).events.length, 2)
  fixture.session = buyer('other-org')
  const other = support.withDemoReceiptPermission({ ...shipped, canConfirmReceipt: true })
  assert.equal(other.canConfirmReceipt, false); assert.equal(other.buyerId, undefined)
})

test('demo 非所属采购组织/历史未分配统一拒绝，非法出库不写覆盖层', async () => {
  await assert.rejects(support.dispatchDemoBatch(batch.id, 'non-buyer-org'), { status: 400 })
  assert.equal((await storage.getById(batch.id)).stage, 'warehousing')
  fixture.session = buyer('other-org')
  await assert.rejects(support.confirmDemoReceipt(batch.id), { status: 404 })
  await assert.rejects(support.confirmDemoReceipt('legacy'), { status: 404 })
  assert.equal((await storage.getById('legacy')).events.length, 0)
})

test('demo 候选读取支持取消，出库等待期间身份变化则放弃写入', async () => {
  const controller = new AbortController(); controller.abort()
  await assert.rejects(support.listDemoDispatchRecipients(controller.signal), { name: 'AbortError' })
  const pending = support.dispatchDemoBatch(batch.id, 'buyer-chenjingxuan')
  fixture.session = null; fixture.status = 'anonymous'
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal((await storage.getById(batch.id)).stage, 'warehousing')
  assert.equal((await storage.getById(batch.id)).events.length, 0)
})
