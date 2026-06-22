import { useEffect, useMemo, useState } from 'react'
import {
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
import {
  type InboxMessage,
  type MessageChannel,
  channelLabel,
  getInboxSnapshot,
  subscribeInboxChanged,
} from '../../mock/message/inbox'
import '../dashboard/index.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

const TAB_ITEMS = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系统消息' },
  { key: 'email', label: '邮件消息' },
  { key: 'chat', label: '聊天消息' },
] as const

type TabKey = (typeof TAB_ITEMS)[number]['key']

export default function MessagesPage() {
  const { token } = theme.useToken()
  const [tab, setTab] = useState<TabKey>('all')
  const [snapshot, setSnapshot] = useState(() => getInboxSnapshot(10))

  const refreshMessages = () => setSnapshot(getInboxSnapshot(10))

  useEffect(() => {
    const unsubscribe = subscribeInboxChanged(refreshMessages)
    window.addEventListener('focus', refreshMessages)
    document.addEventListener('visibilitychange', refreshMessages)
    queueMicrotask(refreshMessages)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', refreshMessages)
      document.removeEventListener('visibilitychange', refreshMessages)
    }
  }, [])

  const dataSource = useMemo(() => {
    if (tab === 'all') return snapshot.all
    return snapshot.all.filter((m) => m.channel === tab)
  }, [snapshot.all, tab])

  const columns: ColumnsType<InboxMessage> = [
    {
      title: '类型',
      dataIndex: 'channel',
      key: 'channel',
      width: 96,
      render: (c: MessageChannel) => (
        <Tag color={c === 'system' ? 'blue' : c === 'email' ? 'purple' : 'green'}>{channelLabel(c)}</Tag>
      ),
    },
    {
      title: '发件人',
      key: 'sender',
      ellipsis: true,
      render: (_, row) =>
        row.channel === 'chat' ? (
          <Space size={6} wrap>
            <Text strong>{row.senderName}</Text>
            {row.senderRole ? <Tag>{row.senderRole}</Tag> : null}
          </Space>
        ) : (
          <Text strong>{row.senderName}</Text>
        ),
    },
    {
      title: '日期',
      dataIndex: 'dateLabel',
      key: 'dateLabel',
      width: 168,
    },
    {
      title: ' ',
      dataIndex: 'preview',
      key: 'preview',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'read',
      key: 'read',
      width: 88,
      render: (read: boolean) =>
        read ? <Text type="secondary">已读</Text> : <Text type="danger">未读</Text>,
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

        <Card
          bordered={false}
          extra={
            <Space>
              <Text type="secondary">本地动态消息 {snapshot.dynamicCount} 条</Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={refreshMessages}>
                刷新消息
              </Button>
            </Space>
          }
        >
          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as TabKey)}
            items={TAB_ITEMS.map((t) => ({ key: t.key, label: t.label }))}
          />
          <Table<InboxMessage>
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={dataSource}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            locale={{ emptyText: '暂无消息' }}
          />
        </Card>

        <Card bordered={false} style={{ marginTop: 16 }} styles={{ body: { padding: 16 } }}>
          <Text type="secondary">
            <BellOutlined /> 记得按时查收未读消息哦
          </Text>
        </Card>
      </Content>
    </Layout>
  )
}
