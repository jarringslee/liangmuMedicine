import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let vite, contract, demo, utils
const code = 'YM-TRACE-2026-0001'
const batch = { traceCode: code, batchNo: 'YM-2026-GS-HQ-0318', herbName: '黄芪', category: 'root',
  origin: { province: '甘肃省', city: '定西市', district: '陇西县' }, growerName: '种植机构',
  plantingStartDate: '2025-03-12', stage: 'warehousing', auditStatus: 'approved', riskLevel: 'normal',
  createdAt: '2026-03-18T01:12:00.000Z', updatedAt: '2026-04-29T01:12:00.000Z',
  events: [{ type: 'stageChange', occurredAt: '2026-04-15T06:08:00.000Z', fromStage: 'harvested', toStage: 'warehousing' }],
  eventsTruncated: false }
before(async () => {
  vite = await createServer({ cacheDir: 'node_modules/.vite-tests/public-trace',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent' })
  contract = await vite.ssrLoadModule('/src/services/publicTraceContract.ts')
  demo = await vite.ssrLoadModule('/src/services/publicTraceDemo.ts')
  utils = await vite.ssrLoadModule('/src/utils/traceCode.ts')
})
after(async () => { await vite?.close() })

test('公开契约只重建白名单，不把自由文本/地址/操作人与附件传给页面', () => {
  const result = contract.parsePublicTraceBatch({ ...batch, id: 'private-id', description: 'private-note',
    origin: { ...batch.origin, address: 'private-address' }, audits: ['private-audit'],
    events: [{ ...batch.events[0], operatorName: 'private-name', title: 'private-title', attachments: ['private-file'] }] }, code)
  assert.deepEqual(result, batch)
  assert.ok(!JSON.stringify(result).includes('private-'))
  assert.deepEqual(contract.parsePublicTraceReply({ batch }, code), batch)
  for (const reply of [null, [], 'not-an-object', {}, { batch: null }]) {
    assert.throws(() => contract.parsePublicTraceReply(reply, code), { code: 'INVALID_RESPONSE' })
  }
})

test('公开契约拒绝未审核、错编号、枚举伪值、错误时间/日期及超过节点上限', () => {
  for (const value of [
    { ...batch, auditStatus: 'pending' }, { ...batch, traceCode: 'OTHER' },
    { ...batch, category: ['root'] }, { ...batch, stage: 'unknown' }, { ...batch, riskLevel: 'critical' },
    { ...batch, origin: { province: '省', city: '' } }, { ...batch, updatedAt: '2026-04-29 09:12' },
    { ...batch, plantingStartDate: '2026-02-30' }, { ...batch, eventsTruncated: 'false' },
    { ...batch, events: Array.from({ length: 101 }, () => batch.events[0]) },
  ]) assert.throws(() => contract.parsePublicTraceBatch(value, code), { code: 'INVALID_RESPONSE' })
})

test('公开节点仅受控类型和倒序；非阶段节点不得携带阶段变更', () => {
  for (const events of [
    [{ ...batch.events[0], type: 'note' }], [{ ...batch.events[0], type: 'audit' }],
    [{ ...batch.events[0], type: 'qcReport' }],
    [batch.events[0], { ...batch.events[0], occurredAt: '2026-04-16T06:08:00Z' }],
  ]) assert.throws(() => contract.parsePublicTraceBatch({ ...batch, events }, code), { code: 'INVALID_RESPONSE' })
  assert.equal(contract.parsePublicTraceBatch({ ...batch, events: [] }, code).events.length, 0)
})

test('demo 按上海时间转换旧数据，仅保留公开节点并明确不可替代服务端安全', () => {
  const old = { ...batch, createdAt: '2026-03-18 09:12', updatedAt: '2026-04-29 09:12',
    events: [
      { ...batch.events[0], occurredAt: '2026-04-15 14:08', description: 'private-text' },
      { type: 'create', occurredAt: '2026-03-18', scopes: ['public'] },
      { type: 'note', occurredAt: '2026-04-01' },
      { type: 'qcReport', occurredAt: '2026-04-16', scopes: ['admin'] },
    ] }
  const result = demo.buildDemoPublicTrace(old)
  assert.equal(result.createdAt, batch.createdAt); assert.equal(result.updatedAt, batch.updatedAt)
  assert.equal(result.events.length, 2)
  assert.equal(result.events[1].occurredAt, '2026-03-17T16:00:00.000Z')
  assert.ok(!JSON.stringify(result).includes('private'))
  assert.equal(demo.buildDemoPublicTrace({ ...old, auditStatus: 'pending' }), null)
  assert.equal(demo.buildDemoPublicTrace(null), null)
})

test('全部已审核离线样例兼容新公开契约；这只是读取 fixture，不执行 seed', async () => {
  const { batches } = JSON.parse(await readFile(new URL('../public/data/herb-batches.json', import.meta.url), 'utf8'))
  assert.ok(batches.some((b) => b.auditStatus === 'approved'))
  for (const b of batches) {
    const result = demo.buildDemoPublicTrace(b)
    assert.equal(result !== null, b.auditStatus === 'approved')
    if (result) assert.equal(result.traceCode, b.traceCode)
  }
})

test('新旧溯源链接和裸码都先校验；拒绝截断、任意编号和超长输入', () => {
  for (const input of [code.toLowerCase(), `https://example.test/trace/${code}`,
    `https://example.test/public/trace/${code}?from=qr#detail`]) assert.equal(utils.extractTraceCode(input), code)
  for (const input of ['', 'hb-0001', 'https://example.test/trace/not-a-code',
    `https://example.test/trace/${code}/private`, `https://example.test/trace/${code}%2Fprivate`,
    'YM-TRACE-2026-', `YM-TRACE-2026-${'A'.repeat(90)}`]) assert.equal(utils.extractTraceCode(input), null)
})
