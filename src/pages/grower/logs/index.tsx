import { useEffect, useMemo, useState } from 'react'
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Layout,
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
import { useHerbStore } from '../../../stores/herbStore'
import { collectPlantingLogs, type PlantingLogRow } from '../../../utils/plantingLogs'
import '../../dashboard/index.less'
import '../../admin/herbs/herbs.less'
import './logs.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

export default function GrowerLogsPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session } = useAuth()
  const data = useHerbStore((s) => s.data)
  const loading = useHerbStore((s) => s.loading)
  const load = useHerbStore((s) => s.load)
  const reload = useHerbStore((s) => s.reload)

  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    void load()
  }, [load])

  const growerId = session?.growerId

  const logs = useMemo(() => {
    const mine = growerId ? data.filter((b) => b.growerId === growerId) : []
    return collectPlantingLogs(mine).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
  }, [data, growerId])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return logs
    return logs.filter(
      (row) =>
        row.title.toLowerCase().includes(kw) ||
        row.herbName.toLowerCase().includes(kw) ||
        row.batchNo.toLowerCase().includes(kw) ||
        (row.description?.toLowerCase().includes(kw) ?? false),
    )
  }, [logs, keyword])

  const columns: ColumnsType<PlantingLogRow> = [
    {
      title: '记录时间',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 150,
    },
    {
      title: '药材',
      dataIndex: 'herbName',
      key: 'herbName',
      width: 100,
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 200,
      ellipsis: true,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 140,
    },
    {
      title: '内容摘要',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc?: string) => desc ?? '—',
    },
    {
      title: '附件',
      dataIndex: 'attachmentCount',
      key: 'attachmentCount',
      width: 72,
      render: (n: number) => (n > 0 ? `${n} 张` : '—'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/trace/${row.traceCode}`, { state: { fromInternal: true } })}
        >
          查看批次
        </Button>
      ),
    },
  ]

  return (
    <Layout className="admin-dashboard herb-admin grower-logs">
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <FileTextOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              种植日志
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
            { title: <span style={{ color: token.colorText }}>种植日志</span> },
          ]}
        />

        <Card bordered={false}>
          <div className="herb-admin__toolbar">
            <Input.Search
              allowClear
              placeholder="搜索 标题 / 药材 / 批次号 / 内容"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onSearch={(v) => setKeyword(v)}
              style={{ width: 320 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => reload()}>
              刷新
            </Button>
            <span className="herb-admin__toolbar-spacer" />
            <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
              共 {filtered.length} 条
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/grower/logs/new')}
            >
              写日志
            </Button>
          </div>

          <Table<PlantingLogRow>
            rowKey={(row) => row.eventId}
            size="small"
            loading={loading}
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 980 }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            locale={{
              emptyText: (
                <Empty
                  description="还没有种植日志，点击「写日志」开始记录"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        </Card>

        <Card bordered={false} style={{ marginTop: 16 }} size="small">
          <Space>
            <MedicineBoxOutlined style={{ color: token.colorPrimary }} />
            <Text type="secondary">
              种植日志会写入对应批次的溯源时间线，管理员与采购商可在详情页查看（审核通过后）。
            </Text>
          </Space>
        </Card>
      </Content>
    </Layout>
  )
}
