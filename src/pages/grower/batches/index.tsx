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
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  EyeOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useHerbBatches } from '../../../hooks/useHerbBatches'
import { AuditTag, RiskTag, StageTag } from '../../../components/herb/herbTags'
import {
  AUDIT_LABEL,
  STAGE_LABEL,
  type AuditStatus,
  type HerbBatch,
  type Stage,
} from '../../../types/herb'
import '../../dashboard/index.less'
import '../../admin/herbs/herbs.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

const STAGE_OPTIONS: { value: Stage | 'all'; label: string }[] = [
  { value: 'all', label: '全部阶段' },
  ...(Object.keys(STAGE_LABEL) as Stage[]).map((s) => ({ value: s, label: STAGE_LABEL[s] })),
]

const AUDIT_OPTIONS: { value: AuditStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部审核' },
  ...(Object.keys(AUDIT_LABEL) as AuditStatus[]).map((s) => ({
    value: s,
    label: AUDIT_LABEL[s],
  })),
]

export default function GrowerBatchesPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data, loading, reload } = useHerbBatches()

  const [keyword, setKeyword] = useState('')
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [audit, setAudit] = useState<AuditStatus | 'all'>('all')

  const growerId = session?.growerId

  /** 只看自己合作社的批次 */
  const mine = useMemo(
    () => (growerId ? data.filter((b) => b.growerId === growerId) : []),
    [data, growerId],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return mine.filter((b) => {
      if (stage !== 'all' && b.stage !== stage) return false
      if (audit !== 'all' && b.auditStatus !== audit) return false
      if (!kw) return true
      return (
        b.herbName.toLowerCase().includes(kw) ||
        b.batchNo.toLowerCase().includes(kw) ||
        b.traceCode.toLowerCase().includes(kw)
      )
    })
  }, [mine, keyword, stage, audit])

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
      width: 160,
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
          {row.stage === 'planting' && row.auditStatus !== 'rejected' ? (
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/grower/logs/new?batchId=${row.id}`)}
            >
              写日志
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
              我的批次
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
            { title: <span style={{ color: token.colorText }}>我的批次</span> },
          ]}
        />

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
            <Select
              value={audit}
              options={AUDIT_OPTIONS}
              onChange={(v) => setAudit(v)}
              style={{ width: 140 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => reload()}>
              刷新
            </Button>
            <span className="herb-admin__toolbar-spacer" />
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
              共 {filtered.length} 条 / 我的 {mine.length} 条
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/grower/batches/new')}
            >
              新建批次
            </Button>
          </div>

          <Table<HerbBatch>
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            locale={{
              emptyText: (
                <Empty
                  description="还没有批次，点击「新建批次」开始建档"
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
