import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { PassThrough } from 'node:stream'
import { createElement } from 'react'
import { renderToString, renderToPipeableStream } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createServer } from 'vite'

let vite, Page, App, fixture, buildTraceUrl
const code = 'YM-TRACE-2026-0001'
const batch = {
  traceCode: code, batchNo: 'YM-2026-GS-HQ-0318', herbName: '黄芪', category: 'root',
  origin: { province: '甘肃省', city: '定西市', district: '陇西县', address: 'private-address' },
  growerName: '种植机构', plantingStartDate: '2025-03-12', stage: 'warehousing',
  auditStatus: 'approved', riskLevel: 'normal', createdAt: '2026-03-18T01:12:00.000Z',
  updatedAt: '2026-04-29T01:12:00.000Z', createdBy: 'private-user',
  events: [{ type: 'stageChange', occurredAt: '2026-04-15T06:08:00.000Z',
    fromStage: 'harvested', toStage: 'warehousing', description: 'private-note' }],
  eventsTruncated: false,
}

before(async () => {
  vite = await createServer({ cacheDir: 'node_modules/.vite-tests/public-trace-page',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent',
    define: { 'import.meta.env.VITE_AUTH_MODE': JSON.stringify('api') },
    plugins: [{ name: 'public-trace-page-fixture', enforce: 'pre',
      resolveId(source, importer) {
        const file = importer?.replaceAll('\\', '/')
        if (source === 'virtual:public-trace-page-fixture' ||
          (source === '../../hooks/usePublicTrace' && file?.endsWith('/pages/trace/Public.tsx')) ||
          (file?.endsWith('/src/App.tsx') && [
            './components/AuthBoundary', './components/assistant/AssistantProvider',
            './hooks/useAuth', './hooks/useHerbBatches', './hooks/useNotifications',
          ].includes(source))) return '\0virtual:public-trace-page-fixture'
        if (source === 'virtual:public-trace-router') return '\0virtual:public-trace-router'
      },
      transform(source, id) {
        if (!id.replaceAll('\\', '/').endsWith('/src/App.tsx')) return
        // 只在测试中用 MemoryRouter 替代依赖浏览器 document 的 BrowserRouter。
        // 真实 Route/Routes、lazy 页面及公开/私有组件层级仍原样执行。
        const original = "import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'"
        assert.ok(source.includes(original), 'App 路由导入改变后需同步测试适配')
        return source.replace(original,
          "import { Navigate, Route, Routes, useLocation } from 'react-router-dom'\n" +
          "import { BrowserRouter } from 'virtual:public-trace-router'")
      },
      load(id) {
        if (id === '\0virtual:public-trace-page-fixture') return `
          import { createElement } from 'react'
          export const fixture = { query: {}, path: '', authCalls: 0 }
          export const usePublicTrace = () => fixture.query
          export function AuthBoundary() {
            fixture.authCalls++; return createElement('p', null, '认证恢复等待')
          }
          function privateOnly() { throw new Error('公开页错误地进入了私有会话/订阅') }
          export const useAuth = privateOnly
          export const useHerbQueryInvalidator = privateOnly
          export const useNotificationRealtime = privateOnly
          export default privateOnly
        `
        if (id === '\0virtual:public-trace-router') return `
          import { createElement } from 'react'
          import { MemoryRouter } from 'react-router-dom'
          import { fixture } from 'virtual:public-trace-page-fixture'
          export * from 'react-router-dom'
          export const BrowserRouter = ({ children }) => createElement(MemoryRouter,
            { initialEntries: [fixture.path] }, children)
        `
      },
    }],
  })
  fixture = (await vite.ssrLoadModule('virtual:public-trace-page-fixture')).fixture
  Page = (await vite.ssrLoadModule('/src/pages/trace/Public.tsx')).default
  App = (await vite.ssrLoadModule('/src/App.tsx')).default
  buildTraceUrl = (await vite.ssrLoadModule('/src/utils/traceUrl.ts')).buildTraceUrl
})
after(async () => { await vite?.close() })
beforeEach(() => {
  fixture.query = { data: batch, isPaused: false, isPending: false, isFetching: false,
    isError: false, refetch: async () => ({ data: batch }) }
  fixture.authCalls = 0
})

const renderPage = (identifier = code) => renderToString(createElement(MemoryRouter,
  { initialEntries: [`/public/trace/${identifier}`] }, createElement(Routes, null,
    createElement(Route, { path: '/public/trace/:traceCode', element: createElement(Page) }))))

test('非法码优先于 disabled Query 的 pending，不能永远显示加载', () => {
  fixture.query.isPending = true
  const html = renderPage('bad-code')
  assert.match(html, /溯源码格式不正确/)
  assert.doesNotMatch(html, /正在查询公开档案/)
})

test('首次/重新获取及离线等待隐藏旧档案，不展示未经重新核验的审核状态', () => {
  for (const state of ['isPending', 'isFetching', 'isPaused']) {
    fixture.query[state] = true
    const html = renderPage()
    assert.match(html, state === 'isPaused' ? /网络暂不可用/ : /正在查询公开档案/)
    assert.doesNotMatch(html, /黄芪|已审核登记|种植机构/)
    fixture.query[state] = false
  }
})

test('查询错误与 404 分开，错误提示不泄漏服务端信息或展示旧档案', () => {
  fixture.query.isError = true
  fixture.query.error = new Error('private-database-secret')
  const failed = renderPage()
  assert.match(failed, /公开档案查询失败/)
  assert.match(failed, /重新查询/)
  assert.doesNotMatch(failed, /private-database-secret|黄芪|档案不存在或暂不可公开/)
  fixture.query.isError = false; fixture.query.data = null
  assert.match(renderPage(), /档案不存在或暂不可公开/)
})

test('公开页只展示白名单字段、受控节点和上海时间，扫码不是唯一入口', () => {
  const html = renderPage()
  for (const text of ['黄芪', '甘肃省', '定西市', '陇西县', '已审核登记']) {
    assert.ok(html.includes(text), `缺少公开展示字段：${text}`)
  }
  assert.match(html, /2026\/03\/18 09:12/)
  assert.match(html, /2026\/04\/15 14:08/)
  assert.match(html, /已采收.*仓储/)
  assert.match(html, /扫码、访问链接或输入溯源码均可查询/)
  assert.match(html, /登录查看完整详情与 AI/)
  assert.doesNotMatch(html, /private-address|private-user|private-note/)
})

test('无公开节点与节点截断有明确提示', () => {
  fixture.query.data = { ...batch, events: [], eventsTruncated: true }
  assert.match(renderPage(), /暂无公开节点/)
  assert.match(renderPage(), /仅展示最近 100 个公开节点/)
})

// SSR 验证真实 App 的路由树；浏览器点击/响应式布局另行人工验收，不由 SSR 推断。
function renderApp() {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    let html = ''
    output.on('data', (chunk) => { html += chunk.toString() })
    output.on('end', () => resolve(html)); output.on('error', reject)
    const stream = renderToPipeableStream(createElement(App), {
      onAllReady() { stream.pipe(output) }, onError(error) { output.destroy(error); stream.abort() },
    })
  })
}

test('真实 App 公开路由绕开认证恢复/私有会话，私有路径仍经过 AuthBoundary',
  { timeout: 10_000 }, async () => {
    fixture.path = `/public/trace/${code}`
    assert.match(await renderApp(), /黄芪/)
    assert.equal(fixture.authCalls, 0)
    fixture.path = `/trace/${code}`
    assert.match(await renderApp(), /认证恢复等待/)
    assert.equal(fixture.authCalls, 1)
  })

test('二维码/分享 URL 指向匿名路由，编号规范化，SSR 返回相对路径', () => {
  assert.equal(buildTraceUrl(` ${code.toLowerCase()} `), `/public/trace/${code}`)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true,
      value: { location: { origin: 'https://example.test' } } })
    assert.equal(buildTraceUrl(code), `https://example.test/public/trace/${code}`)
    assert.equal(buildTraceUrl('A/B'), 'https://example.test/public/trace/A%2FB')
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor)
    else delete globalThis.window
  }
})
