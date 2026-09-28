import { Alert, Button } from 'antd'

type BatchQueryErrorProps = {
  error: Error | null
  onRetry: () => void
}

/** 批次列表统一错误态，避免接口失败时把空数组误展示成“暂无数据”。 */
export default function BatchQueryError({ error, onRetry }: BatchQueryErrorProps) {
  if (!error) return null

  return (
    <Alert
      showIcon
      type="error"
      message="批次数据加载失败"
      description={error.message}
      action={<Button onClick={onRetry}>重试</Button>}
      style={{ marginBottom: 16 }}
    />
  )
}
