import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  Layout,
  Result,
  Select,
  Space,
  Typography,
  Upload,
  message,
  theme,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  FileTextOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuth } from '../../../hooks/useAuth'
import { addBatchEvent } from '../../../services/herbStorage'
import { useHerbStore } from '../../../stores/herbStore'
import '../../dashboard/index.less'
import '../../admin/herbs/herbs.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

type FormValues = {
  batchId: string
  occurredAt: Dayjs
  title: string
  description: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function formatOccurredAt(d: Dayjs): string {
  return d.format('YYYY-MM-DD HH:mm')
}

export default function GrowerLogNewPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const data = useHerbStore((s) => s.data)
  const load = useHerbStore((s) => s.load)

  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [savedTraceCode, setSavedTraceCode] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  const growerId = session?.growerId
  const growerName = session?.growerName ?? session?.displayName

  /** 可写日志的批次：自己的 + 种植中 + 未驳回 */
  const eligibleBatches = useMemo(
    () =>
      growerId
        ? data.filter(
            (b) => b.growerId === growerId && b.stage === 'planting' && b.auditStatus !== 'rejected',
          )
        : [],
    [data, growerId],
  )

  const batchOptions = useMemo(
    () =>
      eligibleBatches.map((b) => ({
        value: b.id,
        label: `${b.herbName} · ${b.batchNo}${b.auditStatus === 'pending' ? '（待审核）' : ''}`,
      })),
    [eligibleBatches],
  )

  useEffect(() => {
    const preset = searchParams.get('batchId')
    if (preset && eligibleBatches.some((b) => b.id === preset)) {
      form.setFieldValue('batchId', preset)
    }
  }, [searchParams, eligibleBatches, form])

  const resetAll = () => {
    form.resetFields()
    form.setFieldValue('occurredAt', dayjs())
    setPhotoUrls([])
    setFileList([])
    setSavedTraceCode(null)
  }

  const handlePhotoUpload = async (file: File) => {
    if (photoUrls.length >= 4) {
      message.warning('最多上传 4 张现场照片')
      return false
    }
    try {
      const url = await readAsDataUrl(file)
      setPhotoUrls((prev) => [...prev, url])
      setFileList((prev) => [
        ...prev,
        { uid: `${file.name}-${Date.now()}`, name: file.name, status: 'done' } as UploadFile,
      ])
      message.success('照片已添加（演示环境存于本地）')
    } catch {
      message.error('照片读取失败')
    }
    return false
  }

  const onFinish = async (values: FormValues) => {
    if (!growerId || !growerName) {
      message.error('当前账号未绑定合作社，无法写日志')
      return
    }

    const batch = eligibleBatches.find((b) => b.id === values.batchId)
    if (!batch) {
      message.error('所选批次不可写日志（需为种植中且未驳回）')
      return
    }

    setSubmitting(true)
    try {
      await addBatchEvent(batch.id, {
        type: 'note',
        title: values.title.trim(),
        description: values.description.trim(),
        occurredAt: formatOccurredAt(values.occurredAt),
        operatorName: growerName,
        operatorRole: 'grower',
        attachments:
          photoUrls.length > 0
            ? photoUrls.map((url, i) => ({
                name: `现场照片${i + 1}.jpg`,
                url,
              }))
            : undefined,
      })
      setSavedTraceCode(batch.traceCode)
      message.success('种植日志已保存')
    } catch (e) {
      message.error(`保存失败：${(e as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout className="admin-dashboard">
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <FileTextOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              写种植日志
            </Title>
          </Space>
          <Link to="/grower/logs">
            <Space>
              <ArrowLeftOutlined />
              返回日志列表
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/grower/dashboard">种植商端</Link> },
            { title: <Link to="/grower/logs">种植日志</Link> },
            { title: <span style={{ color: token.colorText }}>写日志</span> },
          ]}
        />

        {savedTraceCode ? (
          <Card bordered={false}>
            <Result
              status="success"
              title="种植日志已保存"
              subTitle="记录已写入批次溯源时间线，可在详情页查看完整链路。"
              extra={
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() =>
                      navigate(`/trace/${savedTraceCode}`, { state: { fromInternal: true } })
                    }
                  >
                    查看溯源详情
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={resetAll}>
                    继续写日志
                  </Button>
                  <Button
                    icon={<UnorderedListOutlined />}
                    onClick={() => navigate('/grower/logs')}
                  >
                    返回日志列表
                  </Button>
                </Space>
              }
            />
          </Card>
        ) : (
          <Card bordered={false}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
              message={`以 ${growerName ?? '我的合作社'} 名义记录种植过程`}
              description="仅「种植中」且未驳回的批次可写日志。日志会追加到该批次的溯源时间线。"
            />

            {eligibleBatches.length === 0 ? (
              <Result
                status="info"
                title="暂无可写日志的批次"
                subTitle="请先新建批次并确保处于「种植中」阶段，或等待管理员审核（已驳回批次需整改后再记录）。"
                extra={
                  <Space>
                    <Button type="primary" onClick={() => navigate('/grower/batches/new')}>
                      新建批次
                    </Button>
                    <Button onClick={() => navigate('/grower/batches')}>我的批次</Button>
                  </Space>
                }
              />
            ) : (
              <Form<FormValues>
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{ occurredAt: dayjs() }}
                style={{ maxWidth: 640 }}
              >
                <Form.Item
                  name="batchId"
                  label="关联批次"
                  rules={[{ required: true, message: '请选择要记录的批次' }]}
                >
                  <Select
                    placeholder="选择药材批次"
                    options={batchOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Form.Item
                  name="occurredAt"
                  label="记录时间"
                  rules={[{ required: true, message: '请选择记录时间' }]}
                >
                  <DatePicker
                    showTime={{ format: 'HH:mm' }}
                    format="YYYY-MM-DD HH:mm"
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Form.Item
                  name="title"
                  label="日志标题"
                  rules={[
                    { required: true, message: '请填写标题' },
                    { max: 40, message: '标题不超过 40 字' },
                  ]}
                >
                  <Input placeholder="如：苗期巡查、施肥记录、病虫害防治" maxLength={40} showCount />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="详细内容"
                  rules={[
                    { required: true, message: '请填写详细内容' },
                    { max: 500, message: '内容不超过 500 字' },
                  ]}
                >
                  <Input.TextArea
                    rows={5}
                    placeholder="记录现场情况：出苗率、长势、天气、用药施肥、异常现象等"
                    maxLength={500}
                    showCount
                  />
                </Form.Item>

                <Form.Item label="现场照片（可选，最多 4 张）">
                  <Upload
                    accept="image/*"
                    fileList={fileList}
                    beforeUpload={handlePhotoUpload}
                    onRemove={(file) => {
                      const idx = fileList.findIndex((f) => f.uid === file.uid)
                      if (idx >= 0) {
                        setFileList((prev) => prev.filter((_, i) => i !== idx))
                        setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))
                      }
                    }}
                    listType="picture-card"
                  >
                    {fileList.length < 4 ? (
                      <div>
                        <UploadOutlined />
                        <div style={{ marginTop: 8 }}>上传照片</div>
                      </div>
                    ) : null}
                  </Upload>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    演示环境以 base64 存于本地，正式接入后可上传至对象存储
                  </Text>
                </Form.Item>

                <Form.Item style={{ marginBottom: 0 }}>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={submitting}>
                      保存日志
                    </Button>
                    <Button onClick={() => navigate('/grower/logs')}>取消</Button>
                  </Space>
                </Form.Item>
              </Form>
            )}
          </Card>
        )}
      </Content>
    </Layout>
  )
}
