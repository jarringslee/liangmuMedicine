import { useState } from 'react'
import {
  Breadcrumb,
  Button,
  Card,
  Col,
  Collapse,
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
import { mockGrowers } from '../../../mock/herb/growers'
import { addBatch } from '../../../services/herbStorage'
import {
  AUDIT_LABEL,
  HERB_CATEGORY_LABEL,
  RISK_LABEL,
  STAGE_LABEL,
  type AuditStatus,
  type HerbBatch,
  type HerbCategory,
  type RiskLevel,
  type Stage,
} from '../../../types/herb'
import TraceQrPanel from '../../../components/herb/TraceQrPanel'
import { AuditTag, RiskTag, StageTag } from '../../../components/herb/herbTags'
import '../../dashboard/index.less'
import './herbs.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

type FormValues = {
  herbName: string
  category: HerbCategory
  growerId: string
  plantingStartDate: Dayjs
  province: string
  city: string
  district?: string
  address?: string
  environment?: string
  description?: string
  stage: Stage
  auditStatus: AuditStatus
  riskLevel: RiskLevel
}

const HERB_CATEGORY_OPTIONS = (Object.keys(HERB_CATEGORY_LABEL) as HerbCategory[]).map((k) => ({
  value: k,
  label: HERB_CATEGORY_LABEL[k],
}))

const STAGE_OPTIONS = (Object.keys(STAGE_LABEL) as Stage[]).map((k) => ({
  value: k,
  label: STAGE_LABEL[k],
}))

const AUDIT_OPTIONS = (Object.keys(AUDIT_LABEL) as AuditStatus[]).map((k) => ({
  value: k,
  label: AUDIT_LABEL[k],
}))

const RISK_OPTIONS = (Object.keys(RISK_LABEL) as RiskLevel[]).map((k) => ({
  value: k,
  label: RISK_LABEL[k],
}))

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function AdminHerbNewPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [createdBatch, setCreatedBatch] = useState<HerbBatch | null>(null)

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
    setSubmitting(true)
    try {
      const grower = mockGrowers.find((g) => g.id === values.growerId)!
      const batch = await addBatch({
        herbName: values.herbName.trim(),
        category: values.category,
        growerId: grower.id,
        growerName: grower.name,
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
        stage: values.stage,
        auditStatus: values.auditStatus,
        riskLevel: values.riskLevel,
      })
      setCreatedBatch(batch)
      message.success('新增成功，已生成溯源码与二维码')
    } catch (e) {
      message.error(`新增失败：${(e as Error).message}`)
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
              新增药材批次
            </Title>
          </Space>
          <Link to="/admin/herbs">
            <Space>
              <ArrowLeftOutlined />
              返回药材列表
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/dashboard">管理员端</Link> },
            { title: <Link to="/admin/herbs">药材管理</Link> },
            { title: <span style={{ color: token.colorText }}>新增药材批次</span> },
          ]}
        />

        {createdBatch ? (
          <Card bordered={false}>
            <Result
              status="success"
              title="药材批次创建成功"
              subTitle={`已自动生成业务编号与溯源码，二维码可下载或扫描查看`}
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
                    onClick={() => navigate('/admin/herbs')}
                  >
                    返回列表
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
                  <Descriptions.Item label="种植商">{createdBatch.growerName}</Descriptions.Item>
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
                  <Descriptions.Item label="风险状态">
                    <RiskTag level={createdBatch.riskLevel} />
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
        ) : (
          <Card bordered={false}>
            <Form<FormValues>
              form={form}
              layout="vertical"
              requiredMark
              initialValues={{
                category: 'root',
                stage: 'planting',
                auditStatus: 'approved',
                riskLevel: 'normal',
              }}
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
                  <Form.Item
                    name="growerId"
                    label="关联种植商"
                    rules={[{ required: true, message: '请选择种植商' }]}
                  >
                    <Select
                      placeholder="请选择"
                      options={mockGrowers.map((g) => ({
                        value: g.id,
                        label: `${g.name}（${g.region}）`,
                      }))}
                      showSearch
                      optionFilterProp="label"
                    />
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
                    <Input placeholder="如：甘肃省" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item
                    name="city"
                    label="产地 · 市"
                    rules={[{ required: true, message: '必填' }]}
                  >
                    <Input placeholder="如：定西市" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="district" label="产地 · 区/县">
                    <Input placeholder="如：陇西县" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={6}>
                  <Form.Item name="address" label="基地/地块名称">
                    <Input placeholder="如：岐黄黄芪基地 A3 区" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item name="environment" label="环境信息（可选）">
                    <Input.TextArea
                      rows={3}
                      placeholder="如：海拔约 2100m，年均温 7.6℃，沙质壤土"
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

              <Collapse
                ghost
                items={[
                  {
                    key: 'advanced',
                    label: '高级设置（默认值通常无需修改）',
                    children: (
                      <Row gutter={24}>
                        <Col xs={24} md={8}>
                          <Form.Item name="stage" label="当前阶段">
                            <Select options={STAGE_OPTIONS} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item name="auditStatus" label="审核状态">
                            <Select options={AUDIT_OPTIONS} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item name="riskLevel" label="风险等级">
                            <Select options={RISK_OPTIONS} />
                          </Form.Item>
                        </Col>
                      </Row>
                    ),
                  },
                ]}
              />

              <Flex justify="end" gap={12} style={{ marginTop: 16 }}>
                <Button onClick={resetAll}>重置</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  icon={<PlusOutlined />}
                >
                  创建批次并生成溯源码
                </Button>
              </Flex>
            </Form>
          </Card>
        )}
      </Content>
    </Layout>
  )
}
