import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { createElement, lazy, Suspense } from 'react'
import { renderToString, renderToPipeableStream } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import ts from 'typescript'
import { collectStaticFiles } from '../scripts/check-bundle.mjs'

let vite, PageLoading, PageErrorBoundary, RequireAuth, authFixture
before(async () => {
  vite = await createServer({
    cacheDir: 'node_modules/.vite-tests/engineering',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent',
    plugins: [{
      name: 'engineering-auth-fixture', enforce: 'pre',
      resolveId(source, importer) {
        if (source === 'virtual:engineering-auth' ||
          (source === '../hooks/useAuth' && importer?.replaceAll('\\', '/').endsWith('/components/RequireAuth.tsx'))) {
          return '\0virtual:engineering-auth'
        }
      },
      load(id) {
        if (id === '\0virtual:engineering-auth') return 'export const authFixture = { session: null }; export const useAuth = () => authFixture'
      },
    }],
  })
  PageLoading = (await vite.ssrLoadModule('/src/components/PageLoading.tsx')).default
  PageErrorBoundary = (await vite.ssrLoadModule('/src/components/PageErrorBoundary.tsx')).default
  RequireAuth = (await vite.ssrLoadModule('/src/components/RequireAuth.tsx')).RequireAuth
  authFixture = (await vite.ssrLoadModule('virtual:engineering-auth')).authFixture
})
after(async () => { await vite?.close() })

test('页面/图表加载提示有状态语义和保留高度', () => {
  const html = renderToString(createElement(PageLoading, { label: '正在加载图表…', height: 300 }))
  assert.match(html, /role="status"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /min-height:300px/)
  assert.match(html, /正在加载图表/)
})

test('错误边界状态渲染恢复入口，不暴露内部异常；普通状态保持子树', () => {
  const boundary = new PageErrorBoundary({ children: createElement('p', null, '批次列表'), scope: '图表' })
  assert.match(renderToString(boundary.render()), /批次列表/)
  boundary.state = PageErrorBoundary.getDerivedStateFromError(new Error('private database information'))
  const html = renderToString(boundary.render())
  assert.match(html, /图表加载或显示失败/)
  assert.match(html, /重新加载当前页/)
  assert.match(html, /href="\/"/)
  assert.doesNotMatch(html, /private database information|批次列表/)
  // SSR 不捕获 Error Boundary 的子组件错误，真实 import 失败另经浏览器验收。
})

test('Suspense 先输出等待内容，lazy 模块就绪后输出真正组件', { timeout: 5000 }, async (context) => {
  let resolveModule
  const modulePromise = new Promise((resolve) => { resolveModule = resolve })
  const DelayedPage = lazy(() => modulePromise)
  const output = new PassThrough()
  let html = ''
  let firstChunkReady
  const firstChunk = new Promise((resolve) => { firstChunkReady = resolve })
  output.on('data', (chunk) => { html += chunk.toString(); firstChunkReady() })
  let shellReady
  const shell = new Promise((resolve) => { shellReady = resolve })
  const completed = new Promise((resolve, reject) => {
    output.on('end', resolve); output.on('error', reject)
  })
  const stream = renderToPipeableStream(createElement('main', null, createElement(Suspense,
    { fallback: createElement(PageLoading) }, createElement(DelayedPage))), {
    onShellReady() { stream.pipe(output); shellReady() },
    onError(error) { output.destroy(error) },
  })
  context.after(() => stream.abort())
  await shell
  await firstChunk
  assert.match(html, /正在加载页面/)
  resolveModule({ default: () => createElement('p', null, '模块已加载') })
  await completed
  assert.match(html, /模块已加载/)
})

test('角色守卫拒绝越权时不执行 lazy loader，合法角色才进入模块', () => {
  let loads = 0
  const ProtectedPage = lazy(() => { loads++; return Promise.resolve({ default: () => null }) })
  const render = () => renderToString(createElement(MemoryRouter, { initialEntries: ['/dashboard'] },
    createElement(Suspense, { fallback: '加载中' },
      createElement(RequireAuth, { allowedRoles: ['admin'] }, createElement(ProtectedPage)))))
  authFixture.session = { role: 'buyer' }
  assert.match(render(), /没有访问权限/)
  assert.equal(loads, 0)
  authFixture.session = { role: 'admin' }
  render()
  assert.equal(loads, 1)
})

test('构建静态图递归去重/处理环，不把 dynamicImports 计入首屏，缺失项失败', () => {
  const manifest = {
    root: { file: 'root.js', imports: ['shared'], dynamicImports: ['page'] },
    shared: { file: 'shared.js', imports: ['root'] },
    page: { file: 'page.js', imports: ['shared'] },
  }
  assert.deepEqual(collectStaticFiles(manifest, ['root']), ['root.js', 'shared.js'])
  assert.deepEqual(collectStaticFiles(manifest, ['root', 'page']), ['root.js', 'shared.js', 'page.js'])
  assert.throws(() => collectStaticFiles(manifest, ['missing']), /manifest 缺少/)
})

test('图表没有全量 ECharts 引入，JSX 不再使用本刀清理的旧组件属性', () => {
  const chart = readFileSync('src/components/charts/DashboardChart.tsx', 'utf8')
  assert.doesNotMatch(chart, /from ['"](?:echarts|echarts-for-react)['"]/)
  assert.match(chart, /echarts\/core/)
  assert.match(chart, /CanvasRenderer/)
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : entry.name.endsWith('.tsx') ? [join(directory, entry.name)] : [])
  for (const file of walk('src')) {
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const component = node.tagName.getText(ast)
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue
          const name = attr.name.getText(ast)
          const deprecated = (['Card', 'Tag'].includes(component) && name === 'bordered') ||
            (component === 'Space' && name === 'direction') || (component === 'Alert' && name === 'message') ||
            (['Drawer', 'Modal'].includes(component) && name === 'destroyOnClose') ||
            (component === 'Drawer' && name === 'width')
          assert.equal(deprecated, false, `${file}: ${component}.${name}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(ast)
  }
})
