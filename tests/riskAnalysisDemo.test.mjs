import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { beforeEach, afterEach, test } from 'node:test'
import { createServer } from 'vite'

const originalFetch = globalThis.fetch
const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let vite, source, storage, batch

beforeEach(async () => {
  const values = new Map()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() })
  const data = JSON.parse(await readFile(new URL('../public/data/herb-batches.json', import.meta.url), 'utf8'))
  batch = { ...data.batches[0], auditStatus: 'pending', stage: 'planting', riskLevel: 'normal', environment: '完整的种植环境记录' }
  globalThis.fetch = async (url) => {
    assert.match(String(url), /data\/herb-batches\.json$/)
    return new Response(JSON.stringify({ batches: [batch] }))
  }
  vite = await createServer({
    cacheDir: 'node_modules/.vite-tests/risk-demo',
    mode: 'production', server: { middlewareMode: true, hmr: false, watch: null },
    define: { 'import.meta.env.VITE_AUTH_MODE': JSON.stringify('demo') },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent',
  })
  // 经页面使用的统一数据源验证 demo 分支，而不只测试内部实现。
  source = await vite.ssrLoadModule('/src/services/herbDataSource.ts')
  storage = await vite.ssrLoadModule('/src/services/herbStorage.ts')
})

afterEach(async () => {
  await vite.close()
  globalThis.fetch = originalFetch
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage)
  else delete globalThis.localStorage
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else delete globalThis.window
})

test('demo 分析明确标记本地规则，保存后仍待审核且不会被自身事件误判为过期', async () => {
  const analysis = await source.analyzeBatchRisk(batch.id)
  assert.equal(analysis.mode, 'demo')
  assert.equal(analysis.modelName, 'local-rules-demo')
  assert.equal((await storage.getById(batch.id)).auditStatus, 'pending')
  assert.equal((await source.getLatestRiskAnalysis(batch.id)).stale, false)
})

test('demo 公共资料变化使旧建议过期，拒绝继续审核', async () => {
  const analysis = await source.analyzeBatchRisk(batch.id)
  await storage.updateBatch(batch.id, { environment: '管理员看到的依据已经变化' })
  assert.equal((await source.getLatestRiskAnalysis(batch.id)).stale, true)
  await assert.rejects(source.submitRiskReview(batch.id, analysis.id, {
    decision: 'approved', riskLevel: 'normal', reason: '测试人工审核',
  }), /重新分析/)
})

test('demo 保留已有风险，人工复核后更新审核/风险并留下关联记录', async () => {
  await storage.updateBatch(batch.id, { riskLevel: 'high' })
  const analysis = await source.analyzeBatchRisk(batch.id)
  assert.equal(analysis.riskLevel, 'high')
  assert.equal(analysis.recommendation, 'manualReview')
  await source.submitRiskReview(batch.id, analysis.id, {
    decision: 'rejected', riskLevel: 'high', reason: '人工核对后驳回',
  })
  const reviewed = await storage.getById(batch.id)
  assert.equal(reviewed.auditStatus, 'rejected')
  assert.equal(reviewed.riskLevel, 'high')
  assert.match(reviewed.events.at(-1).description, new RegExp(analysis.id))
  assert.equal((await source.getLatestRiskAnalysis(batch.id)).stale, true)
})

test('demo 过程明确标记本地规则，不伪造模型阶段，执行前取消不保存建议', async () => {
  const controller = new AbortController()
  await assert.rejects(source.streamBatchRisk(batch.id, {
    signal: controller.signal, onProgress: () => controller.abort(),
  }), { name: 'AbortError' })
  assert.equal(await source.getLatestRiskAnalysis(batch.id), null)
  const progress = []
  const result = await source.streamBatchRisk(batch.id, {
    signal: new AbortController().signal, onProgress: (item) => progress.push(item),
  })
  assert.equal(result.mode, 'demo')
  assert.equal(progress.length, 2)
  assert.ok(progress.every((item) => item.message.startsWith('本地规则演示')))
  assert.ok(!progress.some((item) => item.stage === 'model'))
})
