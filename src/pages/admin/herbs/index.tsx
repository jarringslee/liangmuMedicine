import { useMemo, useState } from 'react'
import {
  Breadcrumb,
  Button,
  Card,
  Dropdown,
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
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  MedicineBoxOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import {
  AUDIT_LABEL,
  STAGE_LABEL,
  type AuditStatus,
  type HerbBatch,
  type Stage,
} from '../../../types/herb'
import {
  useHerbBatchMutations,
  useHerbBatches,
} from '../../../hooks/useHerbBatches'
import BatchQueryError from '../../../components/herb/BatchQueryError'
import { AuditTag, RiskTag, StageTag } from '../../../components/herb/herbTags'
import { MessageBell } from '../../../components/MessageBell'
import '../../dashboard/index.less'
import './herbs.less'

import type { AuditDecision } from '../../../services/herbDataSource'
import { authMode } from '../../../config/api'

import { useAuth } from '../../../hooks/useAuth'

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

export default function AdminHerbsPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { data, loading, error, reload } = useHerbBatches()

  const {
    setAudit: auditMutation,
    dispatch,
  } = useHerbBatchMutations()

  const [keyword, setKeyword] = useState('')
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [audit, setAudit] = useState<AuditStatus | 'all'>('all')

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return data.filter((b) => {
      if (stage !== 'all' && b.stage !== stage) return false
      if (audit !== 'all' && b.auditStatus !== audit) return false
      if (!kw) return true
      return (
        b.herbName.toLowerCase().includes(kw) ||
        b.batchNo.toLowerCase().includes(kw) ||
        b.traceCode.toLowerCase().includes(kw) ||
        b.growerName.toLowerCase().includes(kw)
      )
    })
  }, [data, keyword, stage, audit])

  const handleAudit = async (
    id: string,
    decision: AuditDecision,
  ) => {
    try {
      await auditMutation.mutateAsync({
        id,
        decision,
      })
      message.success(`已更新为：${AUDIT_LABEL[decision]}`)
    } catch (e) {
      message.error(`更新失败：${(e as Error).message}`)
    }
  }

  const confirmAudit = (
    row: HerbBatch,
    next: AuditDecision,
  ) => {
    if (row.auditStatus === next) {
      message.info(`当前已是「${AUDIT_LABEL[next]}」状态`)
      return
    }
    Modal.confirm({
      title: `确认将该批次置为「${AUDIT_LABEL[next]}」？`,
      content: `批次：${row.batchNo} · ${row.herbName}`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => handleAudit(row.id, next),
    })
  }

  const handleDispatch = async (row: HerbBatch) => {
    try {
      await dispatch.mutateAsync({
        batchId: row.id,
        operatorName: session?.displayName ?? '管理员',
      })
      message.success('已确认出库，批次进入运输中')
    } catch (e) {
      message.error(`出库失败：${(e as Error).message}`)
    }
  }

  const confirmDispatch = (row: HerbBatch) => {
    Modal.confirm({
      title: '确认该批次出库？',
      content: `批次：${row.batchNo} · ${row.herbName}`,
      okText: '确认出库',
      cancelText: '取消',
      onOk: () => handleDispatch(row),
    })
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
      width: 280,
      fixed: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/trace/${row.traceCode}`, { state: { fromInternal: true } })}
          >
            查看
          </Button>
          {row.stage === 'warehousing' ? (
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              loading={
                dispatch.isPending &&
                dispatch.variables?.batchId === row.id
              }
              disabled={row.auditStatus !== 'approved'}
              onClick={() => confirmDispatch(row)}
            >
              确认出库
            </Button>
          ) : null}
          <Dropdown
            menu={{
              items: [
                {
                  key: 'approved',
                  icon: <CheckCircleOutlined style={{ color: token.colorSuccess }} />,
                  label: '审核通过',
                },
                {
                  key: 'rejected',
                  icon: <CloseCircleOutlined style={{ color: token.colorError }} />,
                  label: '驳回',
                },
              ],
              onClick: ({ key }) =>
                confirmAudit(row, key as AuditDecision),
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              loading={
                auditMutation.isPending &&
                auditMutation.variables?.id === row.id
              }
            >
              审核
            </Button>
          </Dropdown>
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
              药材管理
            </Title>
          </Space>
          <Space size="large">
            <MessageBell />
            <Link to="/dashboard">
              <Space>
                <ArrowLeftOutlined />
                返回数据概览
              </Space>
            </Link>
          </Space>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/dashboard">管理员端</Link> },
            { title: <span style={{ color: token.colorText }}>药材管理</span> },
          ]}
        />

        <BatchQueryError error={error} onRetry={reload} />

        <Card bordered={false}>
          <div className="herb-admin__toolbar">
            <Input.Search
              allowClear
              placeholder="搜索 药材 / 批次号 / 溯源码 / 种植商"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={(v) => setKeyword(v)}
              style={{ width: 320 }}
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={authMode === 'api'}
              title={authMode === 'api' ? '真实数据模式请由种植商创建待审核批次' : undefined}
              onClick={() => navigate('/admin/herbs/new')}
            >
              新增药材批次
            </Button>
          </div>

          <Table<HerbBatch>
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 1280 }}
            pagination={{ pageSize: 8, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            locale={{
              emptyText: <Empty description="暂无药材批次" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
            }}
          />
        </Card>
      </Content>
    </Layout>
  )
}
