import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'

let vite, Page, fixture
const batch = { id: 'owned', batchNo: 'YM-OWNED', traceCode: 'YM-TRACE-2026-OWNED', herbName: '黄芪',
  category: 'root', origin: { province: '甘肃', city: '定西' }, growerName: '种植机构',
  auditStatus: 'approved', stage: 'shipped', riskLevel: 'normal', canConfirmReceipt: true }

before(async () => {
  vite = await createServer({ cacheDir: 'node_modules/.vite-tests/batch-dispatch-page',
    server: { middlewareMode: true, hmr: false, watch: null },
    ssr: { noExternal: ['antd', '@ant-design/icons'] },
    optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'silent',
    plugins: [{ name: 'receipt-page-fixture', enforce: 'pre',
      resolveId(source, importer) {
        const page = importer?.replaceAll('\\', '/').endsWith('/pages/buyer/herbs/index.tsx')
        if (source === 'virtual:receipt-page' || page && ['antd', '@ant-design/icons', '../../../hooks/useAuth',
          '../../../hooks/useHerbBatches', '../../../services/auth', '../../../services/herbDataSource',
          '../../../components/herb/BatchQueryError', '../../../components/MessageBell',
          '../../../components/herb/herbTags', '../../../components/herb/QrScanDrawer',
          '../../../components/herb/TraceQuickViewModal'].includes(source)) return '\0virtual:receipt-page'
      },
      load(id) {
        if (id !== '\0virtual:receipt-page') return
        return `
          import { createElement } from 'react'
          export const fixture = { auth: {}, query: {}, mutations: {}, buttons: [], confirmations: [], messages: [], reloads: 0 }
          export const useAuth = () => fixture.auth
          export const getAuthSnapshot = () => fixture.auth
          export const useHerbBatches = () => fixture.query
          export const useHerbBatchMutations = () => fixture.mutations
          export const getHerbBatchByTraceCode = async () => null
          const box = ({ children }) => createElement('div', null, children)
          export const Avatar = box, Breadcrumb = box, Card = box, Col = box, Dropdown = box,
            Empty = box, Flex = box, Row = box, Select = box, Space = box, Spin = box
          export const Input = { Search: box }
          export const Layout = Object.assign(box, { Header: box, Content: box })
          export const Typography = { Title: box, Text: box, Paragraph: box }
          export const theme = { useToken: () => ({ token: {} }) }
          export const Button = (props) => {
            fixture.buttons.push(props)
            return createElement('button', { disabled: props.disabled }, props.children)
          }
          export const Modal = { confirm: (options) => {
            fixture.confirmations.push(options)
            return { destroy: () => options.afterClose?.() }
          } }
          export const message = Object.fromEntries(['success', 'error', 'warning'].map((kind) =>
            [kind, (text) => fixture.messages.push({ kind, text })]))
          export const MessageBell = () => null
          export const EnvironmentOutlined = () => null, EyeOutlined = () => null, LogoutOutlined = () => null,
            MedicineBoxOutlined = () => null, ScanOutlined = () => null, ShopOutlined = () => null,
            TagsOutlined = () => null, UserOutlined = () => null, CheckCircleOutlined = () => null
          export const AuditTag = () => null, RiskTag = () => null, StageTag = () => null
          export default () => null
        `
      },
    }],
  })
  fixture = (await vite.ssrLoadModule('virtual:receipt-page')).fixture
  Page = (await vite.ssrLoadModule('/src/pages/buyer/herbs/index.tsx')).default
})
after(async () => { await vite?.close() })
beforeEach(() => {
  fixture.auth = { status: 'authenticated', session: { userId: 'buyer-a', role: 'buyer', displayName: '采购商' } }
  fixture.query = { data: [batch], loading: false, error: null, reload: () => { fixture.reloads++ } }
  fixture.mutations = { confirmReceipt: { isPending: false, mutateAsync: async () => batch } }
  fixture.buttons = []; fixture.confirmations = []; fixture.messages = []; fixture.reloads = 0
})

function renderPage() {
  fixture.buttons = []
  // 真正执行页面 JSX/React Hooks；组件替身只捕获事件，不验证 AntD 弹窗布局/动画或卸载 Effect。
  return renderToString(createElement(MemoryRouter, null, createElement(Page)))
}
const receiptButtons = () => fixture.buttons.filter((props) => props.children === '确认收货')

test('采购商保留其他已审批次浏览，仅严格 true 的收货能力显示按钮', () => {
  fixture.query.data = [batch, ...[false, undefined, 'true'].map((flag, index) => ({
    ...batch, id: `other-${index}`, canConfirmReceipt: flag,
  })), { ...batch, id: 'unapproved', auditStatus: 'pending' }]
  const html = renderPage()
  assert.equal((html.match(/查看详情/g) ?? []).length, 4)
  assert.equal(receiptButtons().length, 1)
  fixture.mutations.confirmReceipt.isPending = true
  renderPage(); assert.equal(receiptButtons()[0].disabled, true)
})

test('收货点击阻止卡片冒泡、不重复开框；同步锁防重入，失败 finally 释放锁供手动再试', async () => {
  renderPage()
  const button = receiptButtons()[0]
  let stops = 0, calls = 0, complete
  const event = { stopPropagation: () => { stops++ } }
  button.onClick(event); button.onClick(event)
  assert.equal(stops, 2); assert.equal(fixture.confirmations.length, 1)
  const dialog = fixture.confirmations[0]
  fixture.mutations.confirmReceipt.mutateAsync = async (input) => {
    calls++; assert.deepEqual(input, { batchId: batch.id })
    return new Promise((resolve) => { complete = resolve })
  }
  const pending = dialog.onOk(); await dialog.onOk()
  assert.equal(calls, 1); complete(batch); await pending
  fixture.mutations.confirmReceipt.mutateAsync = async () => { calls++; throw new Error('阶段冲突') }
  await dialog.onOk()
  assert.equal(fixture.reloads, 1); assert.ok(fixture.messages.some((item) => item.kind === 'error'))
  fixture.mutations.confirmReceipt.mutateAsync = async () => { calls++; return batch }
  await dialog.onOk(); assert.equal(calls, 3)
})

test('旧收货确认框在账号切换或退出后不发送请求，查询失败时不能开确认框', async () => {
  renderPage(); receiptButtons()[0].onClick({ stopPropagation() {} })
  let calls = 0
  fixture.mutations.confirmReceipt.mutateAsync = async () => { calls++; return batch }
  const dialog = fixture.confirmations[0]
  fixture.auth = { status: 'authenticated', session: { ...fixture.auth.session, userId: 'buyer-b' } }
  await dialog.onOk()
  fixture.auth = { status: 'anonymous', session: null }; await dialog.onOk()
  assert.equal(calls, 0)
  fixture.query.error = new Error('offline'); renderPage()
  assert.equal(receiptButtons()[0].disabled, true)
  receiptButtons()[0].onClick({ stopPropagation() {} })
  assert.equal(fixture.confirmations.length, 1)
})
