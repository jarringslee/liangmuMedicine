import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { after, test } from 'node:test'
import type { Express } from 'express'
import { hash } from 'bcryptjs'
import type { Prisma } from '@prisma/client'
import type { AuthRecord } from '../src/services/auth.js'
import type {
  BatchDetailRecord,
  BatchRepository,
  BatchSummaryRecord,
} from '../src/services/batches.js'

// 测试只使用内存数据，不连接或修改真实 PostgreSQL。
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-secret-not-for-production-0123456789abcdef'
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test'

const { createApp } = await import('../src/app.js')
const { createAuthService } = await import('../src/services/auth.js')
const { createBatchService } = await import('../src/services/batches.js')
const { prisma } = await import('../src/lib/prisma.js')

const password = 'example-password'
const passwordHash = await hash(password, 4)
const roles = ['admin', 'grower', 'processor', 'buyer'] as const

const users = new Map<string, AuthRecord>(roles.map((role) => [role, {
  id: role,
  username: role,
  email: `${role}@example.com`,
  displayName: `${role} 测试用户`,
  role,
  status: 'active',
  passwordHash,
  organizationId: `org-${role}`,
  organization: {
    id: `org-${role}`,
    name: `${role} 组织`,
    type: role === 'admin' ? 'platform' : role,
    enabled: true,
  },
}]))

const authService = createAuthService({
  findByAccount: async (account) => [...users.values()].find(
    (user) => user.username === account || user.email.toLowerCase() === account.toLowerCase(),
  ) ?? null,
  findById: async (id) => users.get(id) ?? null,
})

function organization(id: string, type: 'grower' | 'processor') {
  return {
    id,
    code: id.toUpperCase(),
    name: `${id} 名称`,
    type,
    province: '陕西省',
    city: '西安市',
  }
}

function detailFixture(input: {
  id: string
  herbName: string
  auditStatus: 'pending' | 'approved' | 'rejected'
  stage: 'planting' | 'harvested' | 'processing'
  growerId: string
  processorId: string | null
}): BatchDetailRecord {
  const createdAt = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: input.id,
    batchNo: `BATCH-${input.id}`,
    traceCode: `TRACE-${input.id}`,
    herbName: input.herbName,
    category: 'root',
    plantingStartDate: createdAt,
    origin: { province: '陕西省', city: '西安市' },
    environment: null,
    coverImageUrl: null,
    description: null,
    requiresProcessing: true,
    stage: input.stage,
    auditStatus: input.auditStatus,
    riskLevel: 'normal',
    version: 1,
    createdAt,
    updatedAt: createdAt,
    growerOrganization: organization(input.growerId, 'grower'),
    processorOrganization: input.processorId
      ? organization(input.processorId, 'processor')
      : null,
    createdBy: {
      id: 'creator',
      displayName: '创建人',
      role: 'grower',
    },
    events: [
      {
        id: `${input.id}-public-event`,
        type: 'create',
        title: '公开建档事件',
        description: null,
        payload: null,
        occurredAt: createdAt,
        operatorName: '创建人',
        operatorRole: 'grower',
        visibleRoles: [],
        fromStage: null,
        toStage: null,
        createdAt,
        attachments: [],
      },
      {
        id: `${input.id}-admin-event`,
        type: 'audit',
        title: '管理员内部事件',
        description: null,
        payload: null,
        occurredAt: createdAt,
        operatorName: '管理员',
        operatorRole: 'admin',
        visibleRoles: ['admin'],
        fromStage: null,
        toStage: null,
        createdAt,
        attachments: [],
      },
    ],
    audits: [{
      id: `${input.id}-audit`,
      reviewerName: '管理员',
      decision: 'approved',
      source: 'manual',
      riskLevel: 'normal',
      reason: '测试审核记录',
      evidence: null,
      modelName: null,
      createdAt,
    }],
    attachments: [],
  }
}

const batches = [
  detailFixture({
    id: 'one', herbName: '黄芪', auditStatus: 'pending', stage: 'planting',
    growerId: 'org-grower', processorId: null,
  }),
  detailFixture({
    id: 'two', herbName: '当归', auditStatus: 'approved', stage: 'harvested',
    growerId: 'org-grower', processorId: 'org-processor',
  }),
  detailFixture({
    id: 'three', herbName: '甘草', auditStatus: 'approved', stage: 'processing',
    growerId: 'other-grower', processorId: 'other-processor',
  }),
]

function summaryOf(batch: BatchDetailRecord): BatchSummaryRecord {
          const summary = { ...batch }
          delete (summary as Partial<typeof batch>).events
          delete (summary as Partial<typeof batch>).audits
          delete (summary as Partial<typeof batch>).attachments
  return summary
}

function scalarMatches(value: unknown, condition: unknown): boolean {
  if (condition && typeof condition === 'object' && 'contains' in condition) {
    const contains = String((condition as { contains: unknown }).contains).toLowerCase()
    return String(value).toLowerCase().includes(contains)
  }
  return value === condition
}

/** 只实现本 service 会生成的 Prisma where 子集，用于验证权限条件。 */
function matches(batch: BatchDetailRecord, where: Prisma.HerbBatchWhereInput): boolean {
  const input = where as Record<string, unknown>
  const and = input.AND
  if (Array.isArray(and) && !and.every((item) => matches(batch, item as Prisma.HerbBatchWhereInput))) return false
  const or = input.OR
  if (Array.isArray(or) && !or.some((item) => matches(batch, item as Prisma.HerbBatchWhereInput))) return false

  const values: Record<string, unknown> = {
    id: batch.id,
    traceCode: batch.traceCode,
    batchNo: batch.batchNo,
    herbName: batch.herbName,
    stage: batch.stage,
    auditStatus: batch.auditStatus,
    riskLevel: batch.riskLevel,
    growerOrganizationId: batch.growerOrganization.id,
    processorOrganizationId: batch.processorOrganization?.id ?? null,
  }

  return Object.entries(input).every(([key, condition]) => {
    if (key === 'AND' || key === 'OR') return true
    return scalarMatches(values[key], condition)
  })
}

const batchRepository: BatchRepository = {
  count: async (where) => batches.filter((batch) => matches(batch, where)).length,
  list: async ({ where, skip, take }) => batches
    .filter((batch) => matches(batch, where))
    .slice(skip, skip + take)
    .map(summaryOf),
  findOne: async (where) => batches.find((batch) => matches(batch, where)) ?? null,
  create: async (input) => {
    const createdAt = new Date('2026-09-28T00:00:00.000Z')
    const batch = detailFixture({
      id: `created-${batches.length + 1}`,
      herbName: input.herbName,
      auditStatus: 'pending',
      stage: 'planting',
      growerId: input.growerOrganizationId,
      processorId: null,
    })
    batch.batchNo = input.batchNo
    batch.traceCode = input.traceCode
    batch.category = input.category
    batch.plantingStartDate = input.plantingStartDateValue
    batch.origin = input.origin
    batch.environment = input.environment ?? null
    batch.description = input.description ?? null
    batch.createdAt = createdAt
    batch.updatedAt = createdAt
    batch.createdBy = {
      id: input.creatorId,
      displayName: input.creatorName,
      role: 'grower',
    }
    batch.events = [{
      id: `${batch.id}-create-event`,
      type: 'create',
      title: '批次建档',
      description: null,
      payload: null,
      occurredAt: createdAt,
      operatorName: input.creatorName,
      operatorRole: 'grower',
      visibleRoles: [],
      fromStage: null,
      toStage: null,
      createdAt,
      attachments: [],
    }]
    batch.audits = []
    batches.push(batch)
    return batch
  },
  audit: async (input) => {
    const batch = batches.find((item) => item.id === input.batchId)
    if (!batch) throw new Error('test batch not found')
    const createdAt = new Date('2026-09-28T01:00:00.000Z')
    batch.auditStatus = input.decision
    batch.riskLevel = input.riskLevel
    batch.version += 1
    batch.updatedAt = createdAt
    batch.audits.unshift({
      id: `${batch.id}-audit-${batch.version}`,
      reviewerName: input.reviewerName,
      decision: input.decision,
      source: 'manual',
      riskLevel: input.riskLevel,
      reason: input.reason ?? null,
      evidence: null,
      modelName: null,
      createdAt,
    })
    batch.events.push({
      id: `${batch.id}-audit-event-${batch.version}`,
      type: 'audit',
      title: input.decision === 'approved' ? '管理员审核通过' : '管理员审核驳回',
      description: input.reason ?? null,
      payload: null,
      occurredAt: createdAt,
      operatorName: input.reviewerName,
      operatorRole: 'admin',
      visibleRoles: [],
      fromStage: null,
      toStage: null,
      createdAt,
      attachments: [],
    })
    return batch
  },
}

const batchService = createBatchService(batchRepository)

async function start(app: Express) {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    }),
  }
}

const api = await start(createApp(authService, batchService))

after(async () => {
  await api.close()
  await prisma.$disconnect()
})

async function tokenFor(role: typeof roles[number]) {
  const response = await fetch(`${api.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: role, password, role }),
  })
  assert.equal(response.status, 200)
  return (await response.json()).accessToken as string
}

async function get(path: string, role?: typeof roles[number]) {
  const token = role ? await tokenFor(role) : null
  return fetch(`${api.base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

async function send(
  path: string,
  role: typeof roles[number],
  method: 'POST' | 'PATCH',
  body: unknown,
) {
  const token = await tokenFor(role)
  return fetch(`${api.base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

test('批次接口必须登录，并设置 no-store', async () => {
  assert.equal((await get('/api/batches')).status, 401)
  const response = await get('/api/batches', 'admin')
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('四角色列表遵守数据范围', async () => {
  const expected = { admin: 3, grower: 2, processor: 1, buyer: 2 } as const
  for (const role of roles) {
    const response = await get('/api/batches?pageSize=100', role)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.items.length, expected[role])
    assert.equal(body.pagination.total, expected[role])
  }
})

test('列表支持搜索、状态筛选和分页', async () => {
  const searched = await get('/api/batches?search=当归', 'admin')
  assert.equal(searched.status, 200)
  assert.deepEqual((await searched.json()).items.map((item: { id: string }) => item.id), ['two'])

  const filtered = await get('/api/batches?auditStatus=approved&stage=processing', 'admin')
  assert.deepEqual((await filtered.json()).items.map((item: { id: string }) => item.id), ['three'])

  const paged = await get('/api/batches?page=2&pageSize=1', 'admin')
  const pageBody = await paged.json()
  assert.equal(pageBody.items.length, 1)
  assert.deepEqual(pageBody.pagination, { page: 2, pageSize: 1, total: 3, totalPages: 3 })
})

test('详情支持 ID 和溯源码，并按角色过滤事件与审核记录', async () => {
  const adminResponse = await get('/api/batches/two', 'admin')
  assert.equal(adminResponse.status, 200)
  const adminBatch = (await adminResponse.json()).batch
  assert.equal(adminBatch.events.length, 2)
  assert.equal(adminBatch.audits.length, 1)
  assert.equal('createdById' in adminBatch, false)

  const buyerResponse = await get('/api/batches/TRACE-two', 'buyer')
  assert.equal(buyerResponse.status, 200)
  const buyerBatch = (await buyerResponse.json()).batch
  assert.deepEqual(buyerBatch.events.map((event: { id: string }) => event.id), ['two-public-event'])
  assert.deepEqual(buyerBatch.audits, [])
})

test('不可见批次和不存在批次统一返回 404', async () => {
  const otherOrganization = await get('/api/batches/three', 'grower')
  assert.equal(otherOrganization.status, 404)
  assert.equal((await otherOrganization.json()).error.code, 'BATCH_NOT_FOUND')

  const pendingForBuyer = await get('/api/batches/one', 'buyer')
  assert.equal(pendingForBuyer.status, 404)

  const missing = await get('/api/batches/absent', 'admin')
  assert.equal(missing.status, 404)
})

test('非法分页、枚举、多余参数和非法标识返回 400', async () => {
  for (const path of [
    '/api/batches?page=0',
    '/api/batches?pageSize=101',
    '/api/batches?stage=unknown',
    '/api/batches?organizationId=other-grower',
    '/api/batches/%20',
  ]) {
    const response = await get(path, 'admin')
    assert.equal(response.status, 400, path)
    assert.equal((await response.json()).error.code, 'VALIDATION_ERROR')
  }
})

test('种植商创建待审核批次，组织与初始状态由服务端身份决定', async () => {
  const input = {
    herbName: '丹参',
    category: 'root',
    plantingStartDate: '2026-09-20',
    origin: {
      province: '陕西省',
      city: '西安市',
      district: '长安区',
    },
    environment: '测试种植环境',
    description: '测试批次',
  }
  const response = await send('/api/batches', 'grower', 'POST', input)
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const batch = (await response.json()).batch
  assert.equal(batch.herbName, '丹参')
  assert.equal(batch.auditStatus, 'pending')
  assert.equal(batch.stage, 'planting')
  assert.equal(batch.riskLevel, 'normal')
  assert.equal(batch.growerOrganization.id, 'org-grower')
  assert.equal(batch.createdBy.id, 'grower')
  assert.equal(batch.events[0].type, 'create')
  assert.match(batch.batchNo, /^YM-\d{4}-[A-Z0-9]{10}$/)
  assert.match(batch.traceCode, /^YM-TRACE-\d{4}-[A-Z0-9]{10}$/)

  const forbidden = await send('/api/batches', 'buyer', 'POST', input)
  assert.equal(forbidden.status, 403)

  const injected = await send('/api/batches', 'grower', 'POST', {
    ...input,
    growerOrganizationId: 'other-grower',
    auditStatus: 'approved',
  })
  assert.equal(injected.status, 400)
})

test('只有管理员可以审核，审核同时写入状态、记录和事件', async () => {
  const created = batches.at(-1)!
  const forbidden = await send(
    `/api/batches/${created.id}/audit`,
    'grower',
    'PATCH',
    { decision: 'approved' },
  )
  assert.equal(forbidden.status, 403)

  const response = await send(
    `/api/batches/${created.id}/audit`,
    'admin',
    'PATCH',
    {
      decision: 'approved',
      reason: '资料完整，人工复核通过',
      riskLevel: 'normal',
    },
  )
  assert.equal(response.status, 200)
  const batch = (await response.json()).batch
  assert.equal(batch.auditStatus, 'approved')
  assert.equal(batch.version, 2)
  assert.equal(batch.audits[0].reviewerName, 'admin 测试用户')
  assert.equal(batch.audits[0].reason, '资料完整，人工复核通过')
  assert.equal(batch.events.at(-1).type, 'audit')

  const unchanged = await send(
    `/api/batches/${created.id}/audit`,
    'admin',
    'PATCH',
    { decision: 'approved' },
  )
  assert.equal(unchanged.status, 409)
  assert.equal((await unchanged.json()).error.code, 'AUDIT_STATUS_UNCHANGED')

  const buyerCanRead = await get(`/api/batches/${created.traceCode}`, 'buyer')
  assert.equal(buyerCanRead.status, 200)
})
