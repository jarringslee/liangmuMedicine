import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

// Vite 负责转换 TS/import.meta.env，Node 内置测试器负责断言；无需安装第二套构建工具。
let vite, auth, api, storage, queryClient
const realFetch = globalThis.fetch
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
const user = (role = 'admin') => ({
  id: `user-${role}`, username: role, displayName: '测试用户', email: `${role}@example.com`, role,
  organizationId: `org-${role}`, organization: { id: `org-${role}`, name: '测试组织', type: role === 'admin' ? 'platform' : role },
})
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers })
const failure = (status, code) => json({ error: { code, message: `测试错误 ${code}` } }, status)
const credentials = { account: 'admin', password: 'password', role: 'admin' }

async function setup(mode = 'development') {
  vite = await createServer({
    mode, server: { middlewareMode: true, hmr: false, watch: null },
    define: {
      'import.meta.env.VITE_AUTH_MODE': JSON.stringify(mode === 'production' ? 'demo' : 'api'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api'),
    },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent',
  })
  auth = await vite.ssrLoadModule('/src/services/auth.ts')
  api = await vite.ssrLoadModule('/src/services/api.ts')
  storage = await vite.ssrLoadModule('/src/utils/auth.ts')
  queryClient = (await vite.ssrLoadModule('/src/services/queryClient.ts')).queryClient
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } })
}
beforeEach(async () => {
  const values = new Map()
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } })
  await setup()
})
afterEach(async () => {
  auth.logout()
  await vite.close()
  globalThis.fetch = realFetch
  if (oldStorage) Object.defineProperty(globalThis, 'sessionStorage', oldStorage)
  else delete globalThis.sessionStorage
})
async function loginAs(role = 'admin', token = `token-${role}`) {
  globalThis.fetch = async () => json({ accessToken: token, user: user(role) })
  return auth.login({ ...credentials, role })
}

test('API 登录只保存 Token，角色/组织映射到现有页面字段', async () => {
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return json({ accessToken: 'new-token', user: user('grower') })
  }
  const session = await auth.login({ ...credentials, role: 'grower' })
  assert.equal(request.url, '/api/auth/login')
  assert.equal(request.options.headers.Authorization, undefined)
  assert.equal(session.growerId, 'org-grower')
  assert.equal(storage.getAccessToken(), 'new-token')
  assert.equal(storage.getAuthSession(), null)
  assert.equal(auth.getAuthSnapshot().status, 'authenticated')
})

test('刷新时先 checking，/me 成功才认证；重复恢复只请求一次', async () => {
  storage.setAccessToken('stored-token')
  let resolveResponse, count = 0
  globalThis.fetch = (_url, options) => {
    count++
    assert.equal(options.headers.Authorization, 'Bearer stored-token')
    return new Promise((resolve) => { resolveResponse = resolve })
  }
  const first = auth.restoreAuth()
  const second = auth.restoreAuth()
  assert.equal(first, second)
  assert.equal(auth.getAuthSnapshot().session, null)
  resolveResponse(json({ user: user('processor') }))
  await first
  assert.equal(count, 1)
  assert.equal(auth.getAuthSnapshot().session.processorId, 'org-processor')
})

test('API 模式不会信任旧 Mock 登录资料', async () => {
  sessionStorage.setItem('liangmu_auth', JSON.stringify({ role: 'admin' }))
  globalThis.fetch = () => { throw new Error('不应请求') }
  await auth.restoreAuth()
  assert.equal(auth.getAuthSnapshot().status, 'anonymous')
})

test('401 清除登录和缓存，登录接口的 401 只作为表单错误', async () => {
  await loginAs()
  queryClient.setQueryData(['private'], ['old-user-data'])
  globalThis.fetch = async () => failure(401, 'INVALID_CREDENTIALS')
  await assert.rejects(api.apiRequest('/auth/login', { auth: false }), { status: 401 })
  assert.equal(auth.getAuthSnapshot().status, 'authenticated')
  await assert.rejects(api.apiRequest('/auth/me'), { status: 401 })
  assert.equal(auth.getAuthSnapshot().status, 'anonymous')
  assert.equal(storage.getAccessToken(), null)
  assert.equal(queryClient.getQueryData(['private']), undefined)
})

test('普通 403 保留登录，账号被禁用的 403 清理登录', async () => {
  await loginAs()
  globalThis.fetch = async () => failure(403, 'FORBIDDEN')
  await assert.rejects(api.apiRequest('/restricted'), { status: 403 })
  assert.equal(auth.getAuthSnapshot().status, 'authenticated')
  globalThis.fetch = async () => failure(403, 'ACCOUNT_DISABLED')
  await assert.rejects(api.apiRequest('/auth/me'), { status: 403 })
  assert.equal(auth.getAuthSnapshot().status, 'anonymous')
})

test('网络错误保留 Token 和恢复入口，重试成功后登录', async () => {
  storage.setAccessToken('stored')
  globalThis.fetch = async () => { throw new TypeError('offline') }
  await auth.restoreAuth()
  assert.equal(auth.getAuthSnapshot().status, 'error')
  assert.equal(storage.getAccessToken(), 'stored')
  globalThis.fetch = async () => json({ user: user() })
  await auth.restoreAuth()
  assert.equal(auth.getAuthSnapshot().status, 'authenticated')
})

test('恢复期间退出，迟到的 /me 不能重新登录', async () => {
  storage.setAccessToken('stored')
  let resolveResponse
  globalThis.fetch = () => new Promise((resolve) => { resolveResponse = resolve })
  const pending = auth.restoreAuth()
  auth.logout()
  resolveResponse(json({ user: user() }))
  await pending
  assert.equal(auth.getAuthSnapshot().status, 'anonymous')
})

test('登录期间退出，迟到的成功响应不能覆盖退出状态', async () => {
  let resolveResponse
  globalThis.fetch = () => new Promise((resolve) => { resolveResponse = resolve })
  const pending = auth.login(credentials)
  auth.logout()
  resolveResponse(json({ accessToken: 'late', user: user() }))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(storage.getAccessToken(), null)
})

test('切账号后旧 401 不能踢出新账号，旧成功响应也被丢弃', async () => {
  for (const response of [failure(401, 'INVALID_TOKEN'), json({ data: 'old' })]) {
    await loginAs('admin', 'token-A')
    let resolveResponse
    globalThis.fetch = () => new Promise((resolve) => { resolveResponse = resolve })
    const oldRequest = api.apiRequest('/private')
    auth.logout()
    await loginAs('buyer', 'token-B')
    resolveResponse(response)
    await assert.rejects(oldRequest, { name: 'AbortError' })
    assert.equal(auth.getAuthSnapshot().session.role, 'buyer')
    assert.equal(storage.getAccessToken(), 'token-B')
  }
})

test('退出清除查询和 mutation 缓存，迟到查询不重新填入缓存', async () => {
  await loginAs()
  let resolveQuery
  const pending = queryClient.fetchQuery({ queryKey: ['pending'], queryFn: () => new Promise((resolve) => { resolveQuery = resolve }) })
  const observed = pending.catch(() => undefined)
  queryClient.getMutationCache().build(queryClient, { mutationKey: ['old'] })
  auth.logout()
  resolveQuery('old-account')
  await observed
  assert.equal(queryClient.getQueryCache().getAll().length, 0)
  assert.equal(queryClient.getMutationCache().getAll().length, 0)
})

test('429 保留 Retry-After；无效 JSON、调用方取消和超时能区分', async (context) => {
  globalThis.fetch = async () => json({ error: { code: 'TOO_MANY_ATTEMPTS', message: '请稍后重试' } }, 429, { 'Retry-After': '60' })
  await assert.rejects(api.apiRequest('/auth/login', { auth: false }), { status: 429, retryAfter: '60' })
  globalThis.fetch = async () => new Response('<html>wrong upstream</html>')
  await assert.rejects(api.apiRequest('/auth/login', { auth: false }), { code: 'INVALID_RESPONSE' })
  const controller = new AbortController()
  controller.abort()
  globalThis.fetch = async (_url, options) => { options.signal.throwIfAborted() }
  await assert.rejects(api.apiRequest('/auth/login', { auth: false, signal: controller.signal }), { name: 'AbortError' })
  context.mock.timers.enable({ apis: ['setTimeout'] })
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason)))
  const timeout = api.apiRequest('/auth/login', { auth: false })
  context.mock.timers.tick(15_000)
  await assert.rejects(timeout, { code: 'TIMEOUT' })
  context.mock.timers.reset()
})

test('Token 到期自动清理；存储被禁止时不假装登录成功', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const token = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 10 }))}.signature`
  await loginAs('admin', token)
  context.mock.timers.tick(11_000)
  assert.equal(auth.getAuthSnapshot().status, 'anonymous')
  context.mock.timers.reset()
  sessionStorage.setItem = () => { throw new Error('blocked') }
  await assert.rejects(loginAs(), { code: 'STORAGE_UNAVAILABLE' })
  assert.equal(auth.getAuthSnapshot().status, 'anonymous')
})

test('redirect 拒绝外链、反斜杠、控制字符和登录循环，允许内部详情链接', () => {
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil', '/login?redirect=/profile', '/']) {
    assert.equal(storage.sanitizeRedirectPath(path), null)
  }
  assert.equal(storage.sanitizeRedirectPath('/trace/code?from=list'), '/trace/code?from=list')
})

test('显式 demo 模式完全不请求后端，仍支持四角色演示', async () => {
  auth.logout()
  await vite.close()
  await setup('production')
  globalThis.fetch = () => { throw new Error('演示模式不得请求 API') }
  for (const [account, role] of [['lijialin', 'admin'], ['yuanyuhang', 'grower'], ['haorunyuan', 'processor'], ['chenjingxuan', 'buyer']]) {
    await auth.login({ account, role, password: `${account}123` })
    assert.equal(auth.getAuthSnapshot().session.role, role)
    assert.equal(storage.getAccessToken(), null)
    assert.equal(storage.getAuthSession().role, role)
    auth.logout()
  }
})
