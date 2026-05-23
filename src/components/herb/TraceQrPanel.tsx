import { useMemo, useRef } from 'react'
import { Button, Space, Typography, message } from 'antd'
import { CopyOutlined, DownloadOutlined } from '@ant-design/icons'
import { QRCodeCanvas } from 'qrcode.react'

const { Text } = Typography

type Props = {
  traceCode: string
  /** 二维码尺寸（像素，正方形） */
  size?: number
  /** 不显示文字标签与按钮，仅显示图 */
  compact?: boolean
  /** 自定义说明文案 */
  description?: string
}

export function buildTraceUrl(traceCode: string): string {
  if (typeof window === 'undefined') return `/trace/${traceCode}`
  const base = window.location.origin
  return `${base}/trace/${traceCode}`
}

/** 共用二维码面板：渲染真二维码，支持复制链接 / 下载 PNG */
export default function TraceQrPanel({ traceCode, size = 168, compact = false, description }: Props) {
  const url = useMemo(() => buildTraceUrl(traceCode), [traceCode])
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      message.success('溯源链接已复制')
    } catch {
      message.warning('复制失败，请手动复制链接')
    }
  }

  const downloadPng = () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${traceCode}.png`
    a.click()
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        ref={canvasWrapRef}
        style={{
          padding: 12,
          background: '#fff',
          border: '1px solid #e5ebe7',
          borderRadius: 8,
          lineHeight: 0,
        }}
      >
        <QRCodeCanvas
          value={url}
          size={size}
          level="M"
          marginSize={2}
          fgColor="#1a3e2c"
          bgColor="#ffffff"
        />
      </div>

      {!compact ? (
        <Space direction="vertical" align="center" size={4}>
          <Text strong copyable={{ text: traceCode }} style={{ fontSize: 13 }}>
            {traceCode}
          </Text>
          {description ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {description}
            </Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              扫码或访问链接查看溯源详情
            </Text>
          )}
          <Space size={8} style={{ marginTop: 4 }}>
            <Button size="small" icon={<CopyOutlined />} onClick={copyLink}>
              复制链接
            </Button>
            <Button size="small" icon={<DownloadOutlined />} onClick={downloadPng}>
              下载二维码
            </Button>
          </Space>
        </Space>
      ) : null}
    </div>
  )
}
