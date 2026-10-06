import { useState } from 'react'
import {
  Alert,
  Breadcrumb,
  Button,
  Card,
  Flex,
  Layout,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowLeftOutlined, BellOutlined, MedicineBoxOutlined, ReloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { authMode } from '../../config/api'
import { useNotifications } from '../../hooks/useNotifications'
import type { BusinessNotification, NotificationQuery } from '../../types/notification'
import { formatNotificationTime, notificationTypeLabels } from '../../utils/notification'
import '../dashboard/index.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

const TAB_ITEMS = [
  { key: 'all', label: '全部' },
  { key: 'unread', label: '未读' },
  { key: 'read', label: '已读' },
] as const

export default function MessagesPage() {
  const { token } = theme.useToken()
  // 只保存分页和筛选；通知、loading 和错误全部来自 Query/mutation。
  const [input, setInput] = useState<NotificationQuery>({ page: 1, pageSize: 10, status: 'all' })
  const { query, markRead } = useNotifications(input)
  const data = query.data
  const columns: ColumnsType<BusinessNotification> = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 96,
      render: (type: BusinessNotification['type']) => <Tag color="blue">{notificationTypeLabels[type]}</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 168,
      render: formatNotificationTime,
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'readAt',
      key: 'readAt',
      width: 88,
      render: (readAt: string | null) =>
        readAt ? <Text type="secondary">已读</Text> : <Text type="danger">未读</Text>,
    },
    {
      title: '操作', key: 'actions', width: 190,
      render: (_, row) => (
        <Space>
          {row.batchId && <Link to={`/trace/${encodeURIComponent(row.batchId)}`}>查看批次</Link>}
          {!row.readAt && <Button size="small"
            loading={markRead.isPending && markRead.variables === row.id}
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(row.id, { onSuccess: () => {
              // 未读页最后一条被读掉后，回到上一页，避免停留在空页。
              if (input.status === 'unread' && data?.items.length === 1 && input.page > 1) {
                setInput((current) => current.page === input.page && current.status === input.status
                  ? { ...current, page: current.page - 1 } : current)
              }
            } })}>
            标记已读
          </Button>}
        </Space>
      ),
    },
  ]

  return (
    <Layout className="admin-dashboard" style={{ minHeight: '100vh' }}>
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <MedicineBoxOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              消息中心
            </Title>
          </Space>
          <Link to="/dashboard">
            <Space>
              <ArrowLeftOutlined />
              返回数据概览
            </Space>
          </Link>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: <Link to="/dashboard">管理员端</Link> },
            { title: <span style={{ color: token.colorText }}>消息中心</span> },
          ]}
        />

        <Alert type={authMode === 'api' ? 'info' : 'warning'} showIcon
          title={authMode === 'api' ? '真实业务通知' : '本地演示通知'}
          description={authMode === 'api'
            ? '消息保存在数据库；实时提示和重连会触发重新查询。当前建档产生新通知，聊天与邮件未接入。'
            : '当前使用浏览器演示数据与本地已读记录，不连接通知后端，也不是实时聊天室。'}
          style={{ marginBottom: 16 }} />
        {query.error && <Alert type="error" showIcon title="通知查询失败"
          description={query.error.message} style={{ marginBottom: 16 }} />}
        {markRead.error && <Alert type="error" showIcon title="标记已读失败"
          description={markRead.error.message} style={{ marginBottom: 16 }} />}
        <Card
          variant="borderless"
          extra={
            <Space>
              <Text type="secondary">未读 {data?.unreadCount ?? '—'} 条</Text>
              <Button size="small" icon={<ReloadOutlined />} loading={query.isFetching}
                onClick={() => { void query.refetch() }}>
                刷新消息
              </Button>
            </Space>
          }
        >
          <Tabs
            activeKey={input.status}
            onChange={(status) => {
              if (status === 'all' || status === 'unread' || status === 'read') {
                setInput((current) => ({ ...current, status, page: 1 }))
              }
            }}
            items={TAB_ITEMS.map((t) => ({ key: t.key, label: t.label }))}
          />
          <Table<BusinessNotification>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data?.items ?? []}
            loading={query.isPending || query.isFetching}
            pagination={{ current: input.page, pageSize: input.pageSize, total: data?.total ?? 0,
              showSizeChanger: true, showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => setInput((current) => ({ ...current,
                page: pageSize === current.pageSize ? page : 1, pageSize })),
            }}
            scroll={{ x: 900 }}
            locale={{ emptyText: query.error ? '通知暂不可用，请重试' : '暂无消息' }}
          />
        </Card>

        <Card variant="borderless" style={{ marginTop: 16 }} styles={{ body: { padding: 16 } }}>
          <Text type="secondary">
            <BellOutlined /> 记得按时查收未读消息哦
          </Text>
        </Card>
      </Content>
    </Layout>
  )
}
