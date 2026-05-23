import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Flex,
  Input,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { RcFile } from 'antd/es/upload'
import {
  CameraOutlined,
  CloseCircleOutlined,
  EditOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  ScanOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Html5Qrcode } from 'html5-qrcode'
import type { CameraDevice } from 'html5-qrcode'
import { extractTraceCode } from '../../utils/traceCode'

const { Text, Paragraph } = Typography

type Props = {
  open: boolean
  onClose: () => void
  /** 识别成功后回调（已规范化为大写溯源码） */
  onResult: (traceCode: string) => void
}

type TabKey = 'live' | 'image' | 'manual'

export default function QrScanDrawer({ open, onClose, onResult }: Props) {
  const [active, setActive] = useState<TabKey>('live')

  const handleHit = useCallback(
    (raw: string) => {
      const code = extractTraceCode(raw)
      if (!code) {
        message.error('未能识别溯源码，请确认二维码或重新输入')
        return
      }
      /** 命中后默认重新打开时回到「实时扫码」 */
      setActive('live')
      onResult(code)
    },
    [onResult],
  )

  const handleClose = useCallback(() => {
    setActive('live')
    onClose()
  }, [onClose])

  return (
    <Drawer
      title={
        <Space>
          <ScanOutlined />
          <span>溯源查询</span>
        </Space>
      }
      placement="right"
      open={open}
      onClose={handleClose}
      destroyOnClose
      width={520}
    >
      <Tabs
        activeKey={active}
        onChange={(k) => setActive(k as TabKey)}
        items={[
          {
            key: 'live',
            label: (
              <span>
                <CameraOutlined /> 实时扫码
              </span>
            ),
            children: <LiveScanTab active={active === 'live' && open} onHit={handleHit} />,
          },
          {
            key: 'image',
            label: (
              <span>
                <PictureOutlined /> 图片识别
              </span>
            ),
            children: <ImageScanTab onHit={handleHit} />,
          },
          {
            key: 'manual',
            label: (
              <span>
                <EditOutlined /> 手动输入
              </span>
            ),
            children: <ManualInputTab onHit={handleHit} />,
          },
        ]}
      />
    </Drawer>
  )
}

/* ------------------------------ 实时扫码 ------------------------------- */

type LiveStatus = 'idle' | 'starting' | 'scanning' | 'error'

function LiveScanTab({ active, onHit }: { active: boolean; onHit: (raw: string) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const elementId = `qr-live-region-${uid}`

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const startTokenRef = useRef(0)

  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [cameraId, setCameraId] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<LiveStatus>('idle')
  const [errMsg, setErrMsg] = useState<string>('')

  /** 仅停止并清理扫描器；不更新状态（多次调用安全） */
  const teardown = useCallback(async () => {
    const inst = scannerRef.current
    scannerRef.current = null
    if (!inst) return
    try {
      if (inst.isScanning) {
        await inst.stop()
      }
      await inst.clear()
    } catch {
      /** 静默忽略：组件卸载或快速切换时的边界异常不影响 UX */
    }
  }, [])

  /** 用户点击「停止」：清理后将状态置回 idle */
  const stop = useCallback(async () => {
    await teardown()
    setStatus('idle')
  }, [teardown])

  const start = useCallback(
    async (targetCameraId?: string) => {
      const token = ++startTokenRef.current
      setStatus('starting')
      setErrMsg('')

      /** 先清掉旧实例 */
      await teardown()
      if (token !== startTokenRef.current) return

      const el = document.getElementById(elementId)
      if (!el) {
        setStatus('error')
        setErrMsg('扫码容器未就绪，请稍后重试')
        return
      }

      try {
        const inst = new Html5Qrcode(elementId, { verbose: false })
        scannerRef.current = inst

        await inst.start(
          targetCameraId ? { deviceId: { exact: targetCameraId } } : { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (token !== startTokenRef.current) return
            void teardown()
            onHit(decoded)
          },
          () => {
            /** 每帧解码失败回调，忽略 */
          },
        )
        if (token !== startTokenRef.current) {
          await teardown()
          return
        }
        setStatus('scanning')
      } catch (e) {
        if (token !== startTokenRef.current) return
        const msg = (e as Error)?.message ?? String(e)
        setStatus('error')
        if (/Permission|NotAllowed/i.test(msg)) {
          setErrMsg('未获得摄像头权限，请在浏览器中允许使用摄像头，或改用「图片识别 / 手动输入」。')
        } else if (/NotFound|no.*device/i.test(msg)) {
          setErrMsg('未检测到可用摄像头，请改用「图片识别 / 手动输入」。')
        } else {
          setErrMsg(`摄像头启动失败：${msg}`)
        }
      }
    },
    [elementId, onHit, teardown],
  )

  /** 进入/离开 Tab 时启停 */
  useEffect(() => {
    if (!active) {
      void teardown()
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const list = await Html5Qrcode.getCameras()
        if (cancelled) return
        setCameras(list)
        const preferred =
          list.find((c) => /back|rear|environment|后/i.test(c.label))?.id ?? list[list.length - 1]?.id
        setCameraId(preferred)
        await start(preferred)
      } catch (e) {
        if (cancelled) return
        const msg = (e as Error)?.message ?? String(e)
        setStatus('error')
        setErrMsg(
          /Permission|NotAllowed/i.test(msg)
            ? '未获得摄像头权限，请在浏览器中允许使用摄像头。'
            : `无法枚举摄像头：${msg}`,
        )
      }
    })()

    return () => {
      cancelled = true
      void teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  /** 切换摄像头 */
  const switchCamera = async (id: string) => {
    setCameraId(id)
    await start(id)
  }

  const isInsecureHttp =
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        将摄像头对准溯源二维码，识别成功后会自动跳转到详情页。
      </Paragraph>

      {isInsecureHttp ? (
        <Alert
          type="warning"
          showIcon
          message="当前页面非 HTTPS / localhost，浏览器可能拒绝摄像头权限"
          description="如需在手机或局域网设备上扫码，请使用 HTTPS 部署，或改用「图片识别 / 手动输入」。"
        />
      ) : null}

      {cameras.length > 1 ? (
        <Flex gap={8} align="center" wrap>
          <Text type="secondary" style={{ flex: '0 0 auto' }}>
            摄像头：
          </Text>
          <Select
            value={cameraId}
            onChange={switchCamera}
            style={{ flex: '1 1 240px', maxWidth: 360 }}
            options={cameras.map((c) => ({ value: c.id, label: c.label || c.id }))}
          />
        </Flex>
      ) : null}

      <div
        id={elementId}
        style={{
          width: '100%',
          minHeight: 320,
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative',
        }}
      />

      <Flex gap={8} align="center" wrap>
        <StatusTag status={status} />
        <span style={{ flex: 1 }} />
        {status === 'scanning' ? (
          <Button icon={<PoweroffOutlined />} onClick={() => void stop()}>
            停止
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={status === 'starting'}
            onClick={() => start(cameraId)}
          >
            {status === 'error' ? '重试' : '开始扫描'}
          </Button>
        )}
      </Flex>

      {status === 'error' ? <Alert type="error" showIcon message={errMsg || '摄像头启动失败'} /> : null}
    </Space>
  )
}

function StatusTag({ status }: { status: LiveStatus }) {
  switch (status) {
    case 'scanning':
      return <Tag color="success">正在识别…</Tag>
    case 'starting':
      return <Tag color="processing">启动中…</Tag>
    case 'error':
      return <Tag color="error" icon={<CloseCircleOutlined />}>启动失败</Tag>
    default:
      return <Tag>未启动</Tag>
  }
}

/* ------------------------------ 图片识别 ------------------------------- */

function ImageScanTab({ onHit }: { onHit: (raw: string) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const elementId = `qr-file-region-${uid}`

  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string>('')

  const handleFile = useCallback(
    async (file: RcFile) => {
      setErrMsg('')
      setLoading(true)
      const previewUrl = URL.createObjectURL(file)
      setPreview(previewUrl)
      try {
        const inst = new Html5Qrcode(elementId, { verbose: false })
        try {
          const decoded = await inst.scanFile(file, false)
          onHit(decoded)
        } finally {
          try {
            await inst.clear()
          } catch {
            /** 忽略清理失败 */
          }
        }
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e)
        if (/No.*QR|not found|unable/i.test(msg)) {
          setErrMsg('未能在该图片中识别到二维码，请尝试更清晰的截图。')
        } else {
          setErrMsg(`识别失败：${msg}`)
        }
      } finally {
        setLoading(false)
      }
      return false
    },
    [elementId, onHit],
  )

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        上传一张包含溯源二维码的图片（截图或拍照），系统将自动识别并跳转到详情页。
      </Paragraph>

      <Upload.Dragger
        accept="image/*"
        maxCount={1}
        showUploadList={false}
        beforeUpload={(file) => handleFile(file as RcFile)}
        disabled={loading}
      >
        <p className="ant-upload-drag-icon">
          <PictureOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽图片到此处</p>
        <p className="ant-upload-hint" style={{ paddingInline: 12 }}>
          仅在浏览器本地解析，不会上传到服务器
        </p>
      </Upload.Dragger>

      {preview ? (
        <Flex gap={12} align="flex-start" wrap>
          <img
            src={preview}
            alt="待识别"
            style={{
              width: 144,
              height: 144,
              objectFit: 'cover',
              borderRadius: 8,
              border: '1px solid #e5ebe7',
              background: '#f6f7f5',
            }}
          />
          <Space direction="vertical" size={4} style={{ flex: 1, minWidth: 0 }}>
            {loading ? <Tag color="processing">识别中…</Tag> : null}
            {errMsg ? <Alert type="error" showIcon message={errMsg} /> : null}
          </Space>
        </Flex>
      ) : null}

      {/** html5-qrcode scanFile 需要的承载容器，隐藏 */}
      <div id={elementId} style={{ display: 'none' }} />
    </Space>
  )
}

/* ------------------------------ 手动输入 ------------------------------- */

function ManualInputTab({ onHit }: { onHit: (raw: string) => void }) {
  const [value, setValue] = useState('')

  const previewCode = useMemo(() => extractTraceCode(value), [value])
  const invalid = value.trim().length > 0 && !previewCode

  const submit = () => {
    const v = value.trim()
    if (!v) {
      message.warning('请输入溯源码或溯源链接')
      return
    }
    if (!previewCode) {
      message.error('溯源码格式错误，格式应为 YM-TRACE-2026-0001 或对应链接')
      return
    }
    onHit(v)
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        若你已知溯源码（或拥有完整链接），可直接输入查询。
      </Paragraph>

      <Input
        size="large"
        prefix={<SearchOutlined />}
        placeholder="如：YM-TRACE-2026-0001"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={submit}
        allowClear
        status={invalid ? 'warning' : undefined}
        autoFocus
      />

      <div>
        {previewCode ? (
          <Text type="success">将查询：{previewCode}</Text>
        ) : invalid ? (
          <Text type="warning">未识别到合法溯源码，请检查格式</Text>
        ) : (
          <Text type="secondary">支持完整链接（含 /trace/...）或裸溯源码</Text>
        )}
      </div>

      <Button type="primary" block icon={<SearchOutlined />} onClick={submit}>
        查询溯源详情
      </Button>

      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<Text type="secondary">提示：演示样例可用 YM-TRACE-2026-0001 ~ 0004</Text>}
      />
    </Space>
  )
}
