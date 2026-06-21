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
  message,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  MedicineBoxOutlined,
  ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useHerbBatches } from '../../../hooks/useHerbBatches'
import { setStage as setBatchStage } from '../../../services/herbStorage'
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
      message.success('加工记录已保存，批次阶段已更新为「仓储」')
      closeCompleteModal()
      reload()
    } catch (e) {
      message.error(`完成加工失败：${(e as Error).message}`)
    } finally {
      setCompletingId(null)
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
      width: 240,
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
            scroll={{ x: 1250 }}
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
    </Layout>
  )
}
