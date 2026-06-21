import { useMemo, useState } from 'react'
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Layout,
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
  CheckCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useHerbBatches } from '../../../hooks/useHerbBatches'
import { STAGE_LABEL, type HerbBatch, type Stage } from '../../../types/herb'
import '../../dashboard/index.less'
import '../../admin/herbs/herbs.less'
import '../logs/logs.less'
import './harvest.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

const STAGE_OPTIONS: { value: Stage | 'all'; label: string }[] = [
  { value: 'all', label: '全部阶段' },
  ...(Object.keys(STAGE_LABEL) as Stage[]).map((s) => ({ value: s, label: STAGE_LABEL[s] })),
]

type HarvestRow = {
  batchId: string
  herbName: string
  batchNo: string
  traceCode: string
  stage: Stage
  harvestDate: string
  yieldKg: number
  plotArea?: string
  harvesterName?: string
  photoCount: number
  batch: HerbBatch
}

const YIELD_REGEX = /采收数量：([0-9]+(?:\.[0-9]+)?)\s*kg/
const DATE_REGEX = /采收日期：(\d{4}-\d{2}-\d{2})/
const PLOT_REGEX = /采收地块：([^\n]+)/
const HARVESTER_REGEX = /采收人员：([^\n]+)/

/**
 * 从批次事件链中提取所有「采收登记」事件
 * - 由 recordHarvest() 写入：第一条 type=note 标题为「采收登记」+ 后续 stageChange
 * - 这里按标题识别（与日志 note 区分；日志标题由用户自由输入）
 */
function collectHarvests(batch: HerbBatch): HarvestRow[] {
  const out: HarvestRow[] = []
  for (const ev of batch.events) {
    if (ev.type !== 'note' || ev.title !== '采收登记' || !ev.description) continue
    const date = ev.description.match(DATE_REGEX)?.[1] ?? ev.occurredAt
    const yieldMatch = ev.description.match(YIELD_REGEX)
    if (!yieldMatch) continue
    const yieldKg = Number(yieldMatch[1])
    if (!Number.isFinite(yieldKg)) continue
    out.push({
      batchId: batch.id,
      herbName: batch.herbName,
      batchNo: batch.batchNo,
      traceCode: batch.traceCode,
      stage: batch.stage,
      harvestDate: date,
      yieldKg,
      plotArea: ev.description.match(PLOT_REGEX)?.[1]?.trim(),
      harvesterName: ev.description.match(HARVESTER_REGEX)?.[1]?.trim(),
      photoCount: ev.attachments?.length ?? 0,
      batch,
    })
  }
  return out
}

export default function GrowerHarvestListPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data, reload } = useHerbBatches()

  const [keyword, setKeyword] = useState('')
  const [stage, setStage] = useState<Stage | 'all'>('all')

  const growerId = session?.growerId

  /** 自己的批次 */
  const mine = useMemo(
    () => (growerId ? data.filter((b) => b.growerId === growerId) : []),
    [data, growerId],
  )

  /** 全部采收记录 */
  const allHarvests = useMemo(
    () =>
      mine
        .flatMap((b) => collectHarvests(b))
        .sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)),
    [mine],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return allHarvests.filter((h) => {
      if (stage !== 'all' && h.stage !== stage) return false
      if (!kw) return true
      return (
        h.herbName.toLowerCase().includes(kw) ||
        h.batchNo.toLowerCase().includes(kw) ||
        h.traceCode.toLowerCase().includes(kw)
      )
    })
  }, [allHarvests, keyword, stage])

  const totalYield = useMemo(
    () => allHarvests.reduce((s, h) => s + h.yieldKg, 0),
    [allHarvests],
  )

  const columns: ColumnsType<HarvestRow> = [
    {
      title: '采收日期',
      dataIndex: 'harvestDate',
      key: 'harvestDate',
      width: 120,
    },
    {
      title: '药材',
      dataIndex: 'herbName',
      key: 'herbName',
      width: 120,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 200,
      ellipsis: true,
    },
    {
      title: '采收量 (kg)',
      dataIndex: 'yieldKg',
      key: 'yieldKg',
      width: 110,
      align: 'right',
      render: (n: number) => n.toFixed(2),
    },
    {
      title: '地块',
      dataIndex: 'plotArea',
      key: 'plotArea',
      width: 140,
      ellipsis: true,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: '采收人员',
      dataIndex: 'harvesterName',
      key: 'harvesterName',
      width: 120,
      render: (v?: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: '照片',
      dataIndex: 'photoCount',
      key: 'photoCount',
      width: 70,
      align: 'center',
      render: (n: number) => (n > 0 ? `${n} 张` : <Text type="secondary">—</Text>),
    },
    {
      title: '当前阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 100,
      render: (s: Stage) => STAGE_LABEL[s] ?? s,
    },
    {
      title: '操作',
      key: 'actions',
      width: 130,
      fixed: 'right',
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() =>
            navigate(`/trace/${row.traceCode}`, { state: { fromInternal: true } })
          }
        >
          查看详情
        </Button>
      ),
    },
  ]

  return (
    <Layout className="admin-dashboard herb-admin grower-harvest">
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <CheckCircleOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              采收记录
            </Title>
          </Space>
          <Link to="/grower/dashboard">
            <Space>
              <ArrowLeftOutlined />
              返回种植工作台
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/grower/dashboard">种植商端</Link> },
            { title: <span style={{ color: token.colorText }}>采收记录</span> },
          ]}
        />

        <div className="grower-harvest__summary">
          <div className="grower-harvest__summary-item">
            <span className="grower-harvest__summary-label">采收批次</span>
            <span className="grower-harvest__summary-value">{allHarvests.length}</span>
          </div>
          <div className="grower-harvest__summary-item">
            <span className="grower-harvest__summary-label">累计采收 (kg)</span>
            <span className="grower-harvest__summary-value">{totalYield.toFixed(2)}</span>
          </div>
          <div className="grower-harvest__summary-item">
            <span className="grower-harvest__summary-label">我的批次</span>
            <span className="grower-harvest__summary-value">{mine.length}</span>
          </div>
        </div>

        <Card bordered={false}>
          <div className="herb-admin__toolbar">
            <Input.Search
              allowClear
              placeholder="搜索 药材 / 批次号 / 溯源码"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={(v) => setKeyword(v)}
              style={{ width: 300 }}
            />
            <Select
              value={stage}
              options={STAGE_OPTIONS}
              onChange={(v) => setStage(v)}
              style={{ width: 140 }}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void reload()
                void message.success('已刷新')
              }}
            >
              刷新
            </Button>
            <span className="herb-admin__toolbar-spacer" />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/grower/harvest/new')}
            >
              采收登记
            </Button>
          </div>

          <Table<HarvestRow>
            rowKey={(r) => `${r.batchId}-${r.harvestDate}-${r.yieldKg}`}
            size="small"
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 1000 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            locale={{
              emptyText: (
                <Empty
                  description="还没有采收记录，点击「采收登记」开始记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        </Card>
      </Content>
    </Layout>
  )
}
