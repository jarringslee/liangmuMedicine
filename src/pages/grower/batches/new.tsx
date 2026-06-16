import { useState } from 'react'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Flex,
  Form,
  Input,
  Layout,
  Result,
  Row,
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
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { useAuth } from '../../../hooks/useAuth'
import { addBatch } from '../../../services/herbStorage'
import {
  HERB_CATEGORY_LABEL,
  type HerbBatch,
  type HerbCategory,
} from '../../../types/herb'
import TraceQrPanel from '../../../components/herb/TraceQrPanel'
import { AuditTag, StageTag } from '../../../components/herb/herbTags'
import '../../dashboard/index.less'
import '../../admin/herbs/herbs.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

type FormValues = {
  herbName: string
  category: HerbCategory
  plantingStartDate: Dayjs
  province: string
  city: string
  district?: string
  address?: string
  environment?: string
  description?: string
}

const HERB_CATEGORY_OPTIONS = (Object.keys(HERB_CATEGORY_LABEL) as HerbCategory[]).map((k) => ({
  value: k,
  label: HERB_CATEGORY_LABEL[k],
}))

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function GrowerBatchNewPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [createdBatch, setCreatedBatch] = useState<HerbBatch | null>(null)

  const growerId = session?.growerId
  const growerName = session?.growerName

  const resetAll = () => {
    form.resetFields()
    setCoverDataUrl(null)
    setFileList([])
    setCreatedBatch(null)
  }

  const handleUpload = async (file: File) => {
    try {
      const url = await readAsDataUrl(file)
      setCoverDataUrl(url)
      setFileList([{ uid: file.name, name: file.name, status: 'done' } as UploadFile])
      message.success('封面已选择（演示环境暂未上传至服务器）')
    } catch {
      message.error('封面读取失败')
    }
    return false
  }

  const onFinish = async (values: FormValues) => {
    if (!growerId || !growerName) {
      message.error('当前账号未绑定合作社，无法建档')
      return
    }
    setSubmitting(true)
    try {
      const batch = await addBatch({
        herbName: values.herbName.trim(),
        category: values.category,
        growerId,
        growerName,
        plantingStartDate: values.plantingStartDate.format('YYYY-MM-DD'),
        origin: {
          province: values.province.trim(),
          city: values.city.trim(),
          district: values.district?.trim() || undefined,
          address: values.address?.trim() || undefined,
        },
        environment: values.environment?.trim() || undefined,
        description: values.description?.trim() || undefined,
        coverImageUrl: coverDataUrl ?? '/images/herbs/placeholder.svg',
        /** 种植商建档：固定为种植中 + 待审核，风险由平台后续评定 */
        stage: 'planting',
        auditStatus: 'pending',
        riskLevel: 'normal',
        createdBy: session?.userId,
        createdByRole: 'grower',
      })
      setCreatedBatch(batch)
      message.success('已提交建档，等待管理员审核')
    } catch (e) {
      message.error(`提交失败：${(e as Error).message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout className="admin-dashboard">
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <MedicineBoxOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              新建批次建档
            </Title>
          </Space>
          <Link to="/grower/batches">
            <Space>
              <ArrowLeftOutlined />
              返回我的批次
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/grower/dashboard">种植商端</Link> },
            { title: <Link to="/grower/batches">我的批次</Link> },
            { title: <span style={{ color: token.colorText }}>新建批次</span> },
          ]}
        />

        {createdBatch ? (
          <Card bordered={false}>
            <Result
              status="success"
              title="批次已提交，等待管理员审核"
              subTitle="已自动生成业务编号与溯源码。审核通过后，采购商即可在药材列表中看到该批次。"
              extra={
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() =>
                      navigate(`/trace/${createdBatch.traceCode}`, {
                        state: { fromInternal: true },
                      })
                    }
                  >
                    查看溯源详情
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={resetAll}>
                    继续新增
                  </Button>
                  <Button
                    icon={<UnorderedListOutlined />}
                    onClick={() => navigate('/grower/batches')}
                  >
                    返回我的批次
                  </Button>
                </Space>
              }
            />

            <Divider style={{ marginTop: 0 }} />

            <Row gutter={[24, 24]} align="middle" justify="center">
              <Col xs={24} md={10} style={{ textAlign: 'center' }}>
                <TraceQrPanel traceCode={createdBatch.traceCode} size={200} />
              </Col>
              <Col xs={24} md={14}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="药材">
                    {createdBatch.herbName}（{HERB_CATEGORY_LABEL[createdBatch.category]}）
                  </Descriptions.Item>
                  <Descriptions.Item label="批次号">
                    <Text copyable={{ text: createdBatch.batchNo }}>{createdBatch.batchNo}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="溯源码">
                    <Text copyable={{ text: createdBatch.traceCode }}>{createdBatch.traceCode}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="合作社">{createdBatch.growerName}</Descriptions.Item>
                  <Descriptions.Item label="产地">
                    {[
                      createdBatch.origin.province,
                      createdBatch.origin.city,
                      createdBatch.origin.district,
                      createdBatch.origin.address,
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前阶段">
                    <StageTag stage={createdBatch.stage} />
                  </Descriptions.Item>
                  <Descriptions.Item label="审核状态">
                    <AuditTag status={createdBatch.auditStatus} />
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
        ) : (
          <Card bordered={false}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`当前以「${growerName ?? '未绑定合作社'}」名义建档`}
              description="提交后批次状态为「待审核」，进入管理员审核队列；通过后才会对采购商可见。"
            />

            <Form<FormValues>
              form={form}
              layout="vertical"
              requiredMark
              initialValues={{ category: 'root' }}
              onFinish={onFinish}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="herbName"
                    label="药材名称"
                    rules={[{ required: true, message: '请输入药材名称' }]}
                  >
                    <Input placeholder="如：黄芪" maxLength={32} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="category"
                    label="药材类别"
                    rules={[{ required: true, message: '请选择类别' }]}
                  >
                    <Select options={HERB_CATEGORY_OPTIONS} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item label="关联合作社">
                    <Input value={growerName ?? '未绑定'} disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="plantingStartDate"
                    label="种植开始日期"
                    rules={[{ required: true, message: '请选择种植开始日期' }]}
                  >
                    <DatePicker style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs())} />
                  </Form.Item>
                </Col>

                <Col xs={24} md={6}>
                  <Form.Item
                    name="province"
                    label="产地 · 省"
                    rules={[{ required: true, message: '必填' }]}
                  >
                    <Input placeholder="如：陕西省" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="city"
                    label="产地 · 市"
                    rules={[{ required: true, message: '必填' }]}
                  >
                    <Input placeholder="如：商洛市" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="district" label="产地 · 区/县">
                    <Input placeholder="如：商州区" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="address" label="基地/地块名称">
                    <Input placeholder="如：秦岭本草 3 号地块" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item name="environment" label="环境信息（可选）">
                    <Input.TextArea
                      rows={3}
                      placeholder="如：海拔约 1200m，年均温 12℃，腐殖质壤土"
                      maxLength={200}
                      showCount
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="description" label="备注（可选）">
                    <Input.TextArea rows={3} placeholder="批次相关备注" maxLength={200} showCount />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item label="封面图（演示环境本地暂存）" className="herb-form__upload">
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Upload
                        accept="image/*"
                        fileList={fileList}
                        beforeUpload={(file) => handleUpload(file)}
                        onRemove={() => {
                          setFileList([])
                          setCoverDataUrl(null)
                        }}
                        maxCount={1}
                        listType="text"
                      >
                        <Button icon={<UploadOutlined />}>选择封面图</Button>
                      </Upload>
                      {coverDataUrl ? (
                        <img
                          src={coverDataUrl}
                          alt="封面预览"
                          className="herb-form__cover-preview"
                        />
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          未选择时将使用默认占位图。
                        </Text>
                      )}
                    </Space>
                  </Form.Item>
                </Col>
              </Row>

              <Flex justify="end" gap={12} style={{ marginTop: 16 }}>
                <Button onClick={resetAll}>重置</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={<PlusOutlined />}
                >
                  提交建档（待审核）
                </Button>
              </Flex>
            </Form>
          </Card>
        )}
      </Content>
    </Layout>
  )
}
