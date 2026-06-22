import { useMemo, useState } from 'react'
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Layout,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  Upload,
  message,
  theme,
} from 'antd'
import type { UploadFile } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  FileDoneOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  ToolOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useHerbBatches } from '../../../hooks/useHerbBatches'
import { addBatchEvent, setStage as setBatchStage } from '../../../services/herbStorage'
import { addAdminSystemMessage } from '../../../mock/message/inbox'
import { AuditTag, RiskTag, StageTag } from '../../../components/herb/herbTags'
import { STAGE_LABEL, type HerbBatch, type Stage } from '../../../types/herb'
import '../../dashboard/index.less'
import '../../admin/herbs/herbs.less'

const { Header, Content } = Layout
const { Text, Title } = Typography
const { TextArea } = Input

type ProcessorStage = Extract<Stage, 'harvested' | 'processing' | 'warehousing'>

const PROCESSOR_STAGES: ProcessorStage[] = ['harvested', 'processing', 'warehousing']

const STAGE_OPTIONS: { value: ProcessorStage | 'all'; label: string }[] = [
  { value: 'all', label: '全部加工阶段' },
  ...PROCESSOR_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] })),
]

type LocalReportFile = {
  name: string
  url: string
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function nowDisplay(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ProcessorBatchesPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data, loading, reload } = useHerbBatches()

  const [keyword, setKeyword] = useState('')
  const [stage, setStage] = useState<ProcessorStage | 'all'>('all')
  const [receivingId, setReceivingId] = useState<string | null>(null)
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completingBatch, setCompletingBatch] = useState<HerbBatch | null>(null)
  const [processingNote, setProcessingNote] = useState('')
  const [qcBatch, setQcBatch] = useState<HerbBatch | null>(null)
  const [qcNote, setQcNote] = useState('')
  const [qcFiles, setQcFiles] = useState<LocalReportFile[]>([])
  const [qcFileList, setQcFileList] = useState<UploadFile[]>([])
  const [qcSubmitting, setQcSubmitting] = useState(false)

  /** processor 端第一版：只展示已经进入加工链路相关阶段的批次 */
  const processable = useMemo(
    () => data.filter((b) => PROCESSOR_STAGES.includes(b.stage as ProcessorStage)),
    [data],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return processable.filter((b) => {
      if (stage !== 'all' && b.stage !== stage) return false
      if (!kw) return true
      return (
        b.herbName.toLowerCase().includes(kw) ||
        b.batchNo.toLowerCase().includes(kw) ||
        b.traceCode.toLowerCase().includes(kw) ||
        b.growerName.toLowerCase().includes(kw)
      )
    })
  }, [processable, keyword, stage])

  const handleReceive = async (row: HerbBatch) => {
    if (row.stage !== 'harvested') {
      message.info('只有「已采收」批次可以接收加工')
      return
    }
    if (row.auditStatus !== 'approved') {
      message.info('只有审核通过的批次可以接收加工')
      return
    }

    setReceivingId(row.id)
    try {
      await setBatchStage(row.id, 'processing', {
        operatorName: session?.displayName ?? session?.processorName ?? '加工商',
        operatorRole: 'processor',
        note: `${session?.processorName ?? '加工商'} 已接收该批次，进入加工中。`,
      })
      message.success('已接收加工，批次阶段已更新为「加工中」')
      reload()
    } catch (e) {
      message.error(`接收失败：${(e as Error).message}`)
    } finally {
      setReceivingId(null)
    }
  }

  const confirmReceive = (row: HerbBatch) => {
    Modal.confirm({
      title: '确认接收该批次进入加工？',
      content: `批次：${row.batchNo} · ${row.herbName}`,
      okText: '确认接收',
      cancelText: '取消',
      onOk: () => handleReceive(row),
    })
  }

  const openCompleteModal = (row: HerbBatch) => {
    if (row.stage !== 'processing') {
      message.info('只有「加工中」批次可以完成加工')
      return
    }
    if (row.auditStatus !== 'approved') {
      message.info('只有审核通过的批次可以完成加工')
      return
    }
    setCompletingBatch(row)
    setProcessingNote('')
  }

  const closeCompleteModal = () => {
    setCompletingBatch(null)
    setProcessingNote('')
  }

  const handleCompleteProcessing = async () => {
    if (!completingBatch) return

    const note =
      processingNote.trim() ||
      `${session?.processorName ?? '加工商'} 已完成基础加工，批次进入仓储待复核。`

    setCompletingId(completingBatch.id)
    try {
      await setBatchStage(completingBatch.id, 'warehousing', {
        operatorName: session?.displayName ?? session?.processorName ?? '加工商',
        operatorRole: 'processor',
        note,
      })
      addAdminSystemMessage({
        senderName: '加工入库通知',
        preview: `${completingBatch.herbName} 批次 ${completingBatch.batchNo} 已由 ${
          session?.processorName ?? '加工商'
        } 完成加工并进入仓储，请管理员复核后续入库/出库安排。`,
      })
      message.success('加工记录已保存，已通知管理员复核入库')
      closeCompleteModal()
      reload()
    } catch (e) {
      message.error(`完成加工失败：${(e as Error).message}`)
    } finally {
      setCompletingId(null)
    }
  }

  const openQcModal = (row: HerbBatch) => {
    if (!['processing', 'warehousing'].includes(row.stage)) {
      message.info('只有「加工中」或「仓储」批次可以上传质检报告')
      return
    }
    if (row.auditStatus !== 'approved') {
      message.info('只有审核通过的批次可以上传质检报告')
      return
    }
    setQcBatch(row)
    setQcNote('')
    setQcFiles([])
    setQcFileList([])
  }

  const closeQcModal = () => {
    setQcBatch(null)
    setQcNote('')
    setQcFiles([])
    setQcFileList([])
  }

  const handleQcUpload = async (file: File) => {
    const isSupported = file.type.startsWith('image/') || file.type === 'application/pdf'
    if (!isSupported) {
      message.warning('仅支持 PDF 或图片报告')
      return false
    }
    if (file.size > 2 * 1024 * 1024) {
      message.warning('演示环境单个文件请控制在 2MB 内')
      return false
    }
    if (qcFiles.length >= 3) {
      message.warning('最多上传 3 个质检附件')
      return false
    }

    try {
      const url = await readAsDataUrl(file)
      setQcFiles((prev) => [...prev, { name: file.name, url }])
      setQcFileList((prev) => [
        ...prev,
        { uid: `${file.name}-${Date.now()}`, name: file.name, status: 'done' } as UploadFile,
      ])
      message.success('报告已添加（演示环境存于本地）')
    } catch {
      message.error('报告读取失败')
    }
    return false
  }

  const handleSaveQcReport = async () => {
    if (!qcBatch) return
    if (qcFiles.length === 0) {
      message.warning('请至少上传 1 个质检报告附件')
      return
    }

    setQcSubmitting(true)
    try {
      await addBatchEvent(qcBatch.id, {
        type: 'qcReport',
        title: '加工质检报告',
        description:
          qcNote.trim() ||
          `${session?.processorName ?? '加工商'} 已上传加工质检报告，等待平台复核。`,
        occurredAt: nowDisplay(),
        operatorName: session?.displayName ?? session?.processorName ?? '加工商',
        operatorRole: 'processor',
        attachments: qcFiles,
      })
      message.success('质检报告已保存到溯源档案')
      closeQcModal()
      reload()
    } catch (e) {
      message.error(`保存质检报告失败：${(e as Error).message}`)
    } finally {
      setQcSubmitting(false)
    }
  }

  const columns: ColumnsType<HerbBatch> = [
    {
      title: '封面',
      key: 'cover',
      width: 80,
      render: (_, row) => (
        <span
          className="herb-admin__thumb"
          aria-label={row.herbName}
          style={{
            backgroundImage: `url(${row.coverImageUrl ?? '/images/herbs/placeholder.svg'})`,
          }}
        />
      ),
    },
    {
      title: '药材',
      key: 'herb',
      render: (_, row) => (
        <div style={{ minWidth: 120 }}>
          <Text strong>{row.herbName}</Text>
        </div>
      ),
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 200,
      ellipsis: true,
    },
    {
      title: '溯源码',
      dataIndex: 'traceCode',
      key: 'traceCode',
      width: 200,
      ellipsis: true,
      render: (code: string) => <Text copyable={{ text: code }}>{code}</Text>,
    },
    {
      title: '种植商',
      dataIndex: 'growerName',
      key: 'growerName',
      width: 160,
      ellipsis: true,
    },
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 100,
      render: (s: HerbBatch['stage']) => <StageTag stage={s} />,
    },
    {
      title: '审核',
      dataIndex: 'auditStatus',
      key: 'auditStatus',
      width: 100,
      render: (s: HerbBatch['auditStatus']) => <AuditTag status={s} />,
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 88,
      render: (s: HerbBatch['riskLevel']) => <RiskTag level={s} />,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 150,
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      fixed: 'right',
      render: (_, row) => (
        <Space size={0}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/trace/${row.traceCode}`, { state: { fromInternal: true } })}
          >
            查看
          </Button>
          {row.stage === 'harvested' ? (
            <Button
              type="link"
              size="small"
              icon={<ToolOutlined />}
              loading={receivingId === row.id}
              disabled={row.auditStatus !== 'approved'}
              onClick={() => confirmReceive(row)}
            >
              接收加工
            </Button>
          ) : null}
          {row.stage === 'processing' ? (
            <Button
              type="link"
              size="small"
              icon={<ToolOutlined />}
              loading={completingId === row.id}
              disabled={row.auditStatus !== 'approved'}
              onClick={() => openCompleteModal(row)}
            >
              完成加工
            </Button>
          ) : null}
          {row.stage === 'processing' || row.stage === 'warehousing' ? (
            <Button
              type="link"
              size="small"
              icon={<FileDoneOutlined />}
              disabled={row.auditStatus !== 'approved'}
              onClick={() => openQcModal(row)}
            >
              质检报告
            </Button>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <Layout className="admin-dashboard herb-admin">
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <MedicineBoxOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              加工批次
            </Title>
          </Space>
          <Link to="/processor/dashboard">
            <Space>
              <ArrowLeftOutlined />
              返回加工工作台
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/processor/dashboard">加工商端</Link> },
            { title: <span style={{ color: token.colorText }}>加工批次</span> },
          ]}
        />

        <Card bordered={false}>
          <div className="herb-admin__toolbar">
            <Input.Search
              allowClear
              placeholder="搜索 药材 / 批次号 / 溯源码 / 种植商"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={(v) => setKeyword(v)}
              style={{ width: 340 }}
            />
            <Select
              value={stage}
              options={STAGE_OPTIONS}
              onChange={(v) => setStage(v)}
              style={{ width: 160 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => reload()}>
              刷新
            </Button>
            <span className="herb-admin__toolbar-spacer" />
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
              共 {filtered.length} 条 / 可处理 {processable.length} 条
            </Text>
          </div>

          <Table<HerbBatch>
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 1380 }}
            pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            locale={{
              emptyText: (
                <Empty
                  description="暂无可处理加工批次"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        </Card>
      </Content>
      <Modal
        title="完成加工并入库"
        open={Boolean(completingBatch)}
        okText="确认入库"
        cancelText="取消"
        confirmLoading={Boolean(completingId)}
        onOk={handleCompleteProcessing}
        onCancel={closeCompleteModal}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">
            {completingBatch
              ? `批次：${completingBatch.batchNo} · ${completingBatch.herbName}`
              : null}
          </Text>
          <TextArea
            rows={4}
            value={processingNote}
            maxLength={200}
            showCount
            placeholder="填写简短加工记录，例如：完成净选、切制、干燥，外观与气味符合仓储要求。"
            onChange={(e) => setProcessingNote(e.target.value)}
          />
        </Space>
      </Modal>
      <Modal
        title="上传质检报告"
        open={Boolean(qcBatch)}
        okText="保存报告"
        cancelText="取消"
        confirmLoading={qcSubmitting}
        onOk={handleSaveQcReport}
        onCancel={closeQcModal}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Text type="secondary">
            {qcBatch ? `批次：${qcBatch.batchNo} · ${qcBatch.herbName}` : null}
          </Text>
          <Upload
            fileList={qcFileList}
            beforeUpload={handleQcUpload}
            onRemove={(file) => {
              setQcFileList((prev) => prev.filter((item) => item.uid !== file.uid))
              setQcFiles((prev) => prev.filter((item) => item.name !== file.name))
            }}
            accept="application/pdf,image/*"
            multiple
          >
            <Button icon={<UploadOutlined />}>选择 PDF / 图片报告</Button>
          </Upload>
          <TextArea
            rows={4}
            value={qcNote}
            maxLength={200}
            showCount
            placeholder="填写质检摘要，例如：水分、灰分、外观性状均符合内部入库标准。"
            onChange={(e) => setQcNote(e.target.value)}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            当前为前端演示：附件以 data url 存入本地覆盖层，后续接入后端后会替换为 R2 或对象存储地址。
          </Text>
        </Space>
      </Modal>
    </Layout>
  )
}
