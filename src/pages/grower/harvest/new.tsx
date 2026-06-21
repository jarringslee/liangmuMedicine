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
  InputNumber,
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
import dayjs, { type Dayjs } from 'dayjs'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useAuth } from '../../../hooks/useAuth'
import { useHerbBatches } from '../../../hooks/useHerbBatches'
import { recordHarvest } from '../../../services/herbStorage'
import { STAGE_LABEL } from '../../../types/herb'
import '../../dashboard/index.less'
import '../logs/logs.less'
import './harvest.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

type FormValues = {
  batchId: string
  harvestDate: Dayjs
  yieldKg: number
  plotArea?: string
  harvesterName?: string
  note?: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const MAX_PHOTOS = 4

export default function GrowerHarvestNewPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useAuth()
  const { data } = useHerbBatches()

  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [savedTraceCode, setSavedTraceCode] = useState<string | null>(null)

  const growerId = session?.growerId
  const growerName = session?.growerName ?? session?.displayName

  /** 可采收的批次：自己的 + 种植中 + 未驳回 */
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
    form.setFieldValue('harvestDate', dayjs())
    form.setFieldValue('harvesterName', growerName)
    setPhotoUrls([])
    setFileList([])
    setSavedTraceCode(null)
  }

  const handlePhotoUpload = async (file: File) => {
    if (photoUrls.length >= MAX_PHOTOS) {
      message.warning(`最多上传 ${MAX_PHOTOS} 张现场照片`)
      return false
    }
    try {
      const url = await readAsDataUrl(file)
      setPhotoUrls((prev) => [...prev, url])
      setFileList((prev) => [
        ...prev,
        { uid: `${file.name}-${Date.now()}`, name: file.name, status: 'done' } as UploadFile,
      ])
    } catch {
      message.error('照片读取失败')
    }
    return false
  }

  const onFinish = async (values: FormValues) => {
    if (!growerId || !growerName) {
      message.error('当前账号未绑定合作社，无法采收登记')
      return
    }
    const batch = eligibleBatches.find((b) => b.id === values.batchId)
    if (!batch) {
      message.error('所选批次不可采收（需为种植中且未驳回）')
      return
    }

    setSubmitting(true)
    try {
      await recordHarvest(
        batch.id,
        {
          harvestDate: values.harvestDate.format('YYYY-MM-DD'),
          yieldKg: values.yieldKg,
          plotArea: values.plotArea?.trim() || undefined,
          harvesterName: values.harvesterName?.trim() || undefined,
          note: values.note?.trim() || undefined,
          photos: photoUrls.map((url, i) => ({
            name: `采收现场${i + 1}.jpg`,
            url,
          })),
        },
        {
          userId: session?.userId ?? '',
          displayName: growerName,
          growerId,
          growerName,
        },
      )
      setSavedTraceCode(batch.traceCode)
      message.success('采收登记已保存，阶段已流转至「已采收」')
    } catch (e) {
      message.error(`保存失败：${(e as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout className="admin-dashboard grower-harvest">
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <CheckCircleOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              采收登记
            </Title>
          </Space>
          <Link to="/grower/harvest">
            <Space>
              <ArrowLeftOutlined />
              返回采收记录
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/grower/dashboard">种植商端</Link> },
            { title: <Link to="/grower/harvest">采收记录</Link> },
            { title: <span style={{ color: token.colorText }}>登记</span> },
          ]}
        />

        {savedTraceCode ? (
          <Card bordered={false}>
            <Result
              status="success"
              title="采收登记已完成"
              subTitle="批次阶段已从「种植中」流转到「已采收」，可在溯源详情中查看完整链路。"
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
                    继续登记
                  </Button>
                  <Button
                    icon={<UnorderedListOutlined />}
                    onClick={() => navigate('/grower/harvest')}
                  >
                    返回采收记录
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
              style={{ marginBottom: 16 }}
              message={`以 ${growerName ?? '我的合作社'} 名义进行采收登记`}
              description={`仅「种植中」且未驳回的批次可采收。提交后批次阶段将自动流转到「${STAGE_LABEL.harvested}」，并写入溯源时间轴。`}
            />

            {eligibleBatches.length === 0 ? (
              <Result
                status="info"
                title="暂无可采收的批次"
                subTitle="请先新建批次并确保处于「种植中」阶段（已驳回批次需整改后再采收）。"
                extra={
                  <Space>
                    <Button type="primary" onClick={() => navigate('/grower/batches/new')}>
                      新建批次
                    </Button>
                    <Button onClick={() => navigate('/grower/harvest')}>采收记录</Button>
                  </Space>
                }
              />
            ) : (
              <Form<FormValues>
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{ harvestDate: dayjs(), harvesterName: growerName }}
                style={{ maxWidth: 640 }}
              >
                <Form.Item
                  name="batchId"
                  label="关联批次"
                  rules={[{ required: true, message: '请选择要采收的批次' }]}
                >
                  <Select
                    placeholder="选择药材批次"
                    options={batchOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>

                <Form.Item
                  name="harvestDate"
                  label="采收日期"
                  rules={[{ required: true, message: '请选择采收日期' }]}
                >
                  <DatePicker
                    format="YYYY-MM-DD"
                    style={{ width: '100%' }}
                    disabledDate={(d) => d && d.isAfter(dayjs().endOf('day'))}
                  />
                </Form.Item>

                <Form.Item
                  name="yieldKg"
                  label="采收数量 (kg)"
                  rules={[
                    { required: true, message: '请填写采收数量' },
                    {
                      validator: (_, v) =>
                        v === undefined || v === null || v <= 0
                          ? Promise.reject(new Error('采收数量必须大于 0'))
                          : Promise.resolve(),
                    },
                  ]}
                >
                  <InputNumber<number>
                    min={0}
                    step={0.1}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder="如：120.50"
                  />
                </Form.Item>

                <Form.Item name="plotArea" label="采收地块（可选）">
                  <Input placeholder="如：A 区北坡 3 号地" maxLength={60} />
                </Form.Item>

                <Form.Item name="harvesterName" label="采收人员（可选）">
                  <Input placeholder="留空默认当前账号" maxLength={40} />
                </Form.Item>

                <Form.Item
                  name="note"
                  label="备注（可选）"
                  rules={[{ max: 300, message: '备注不超过 300 字' }]}
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="采收批次、品质初评、天气、注意事项等"
                    maxLength={300}
                    showCount
                  />
                </Form.Item>

                <Form.Item label={`现场照片（可选，最多 ${MAX_PHOTOS} 张）`}>
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
                    {fileList.length < MAX_PHOTOS ? (
                      <div>
                        <UploadOutlined />
                        <div style={{ marginTop: 8 }}>上传照片</div>
                      </div>
                    ) : null}
                  </Upload>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    演示环境以 base64 存于本地，阶段将流转至「{STAGE_LABEL.harvested}」
                  </Text>
                </Form.Item>

                <Form.Item style={{ marginBottom: 0 }}>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={submitting}>
                      提交采收登记
                    </Button>
                    <Button onClick={() => navigate('/grower/harvest')}>取消</Button>
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
