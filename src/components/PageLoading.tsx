import { Spin, Typography } from 'antd'

export default function PageLoading({ label = '正在加载页面…', height = '60vh' }: {
  label?: string
  height?: number | string
}) {
  return <div role="status" aria-live="polite" style={{
    minHeight: height, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  }}>
    <Spin />
    <Typography.Text type="secondary">{label}</Typography.Text>
  </div>
}
