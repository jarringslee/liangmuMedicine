import { Component } from 'react'
import type { ReactNode } from 'react'
import { Button, Result, Space } from 'antd'

type Props = { children: ReactNode; scope?: '页面' | '图表' }

// Error Boundary 捕获子树的渲染错误和 lazy import 失败；不负责请求/事件回调错误。
export default class PageErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const scope = this.props.scope ?? '页面'
    return <div role="alert">
      <Result
        status="warning"
        title={`${scope}加载或显示失败`}
        subTitle="请检查网络后重新加载；若刚发布了新版本，也可能是旧资源已失效。"
        extra={<Space wrap>
          {/* lazy 会缓存失败结果，仅重置边界不能重新下载模块，需用户主动整页刷新。 */}
          <Button type="primary" onClick={() => window.location.reload()}>
            重新加载当前页
          </Button>
          <Button href="/">返回首页</Button>
        </Space>}
      />
    </div>
  }
}
