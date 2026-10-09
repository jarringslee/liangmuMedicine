import {
  Alert, Avatar, Breadcrumb, Button, Card, Col, Empty, Flex, Layout,
  Row, Space, Spin, Statistic, Table, Typography, theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AuditOutlined, DashboardOutlined, MedicineBoxOutlined,
  MessageOutlined, ReloadOutlined, UserOutlined,
} from '@ant-design/icons'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import PageLoading from '../../components/PageLoading'
import PageErrorBoundary from '../../components/PageErrorBoundary'
import type { DashboardChartOption } from '../../components/charts/DashboardChart'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardOverview } from '../../hooks/useDashboardOverview'
import { MessageBell } from '../../components/MessageBell'
import { AuditTag, RiskTag, StageTag } from '../../components/herb/herbTags'
import { HERB_CATEGORY_LABEL, STAGE_LABEL } from '../../types/herb'
import type { DashboardBatch } from '../../types/dashboard'
import { formatDashboardTime } from '../../utils/dashboard'
import './index.less'

const { Header, Sider, Content } = Layout
const { Title, Paragraph, Text } = Typography
const DashboardChart = lazy(() => import('../../components/charts/DashboardChart'))

// 图表单独延迟加载/兜底，失败不会遮住统计和批次列表。
function ChartPanel({ option }: { option: DashboardChartOption }) {
  return <PageErrorBoundary scope="图表">
    <Suspense fallback={<PageLoading label="正在加载图表…" height={300} />}>
      <DashboardChart option={option} />
    </Suspense>
  </PageErrorBoundary>
}

// 只保留已经实现、可以到达的页面。
const menus = [
  { path: '/dashboard', label: '数据概览', icon: <DashboardOutlined /> },
  { path: '/admin/herbs', label: '药材管理', icon: <MedicineBoxOutlined /> },
  { path: '/messages', label: '业务通知', icon: <MessageOutlined /> },
  { path: '/chat', label: '人工沟通', icon: <MessageOutlined /> },
  { path: '/profile', label: '个人资料', icon: <UserOutlined /> },
]
const batchPath = (batch: DashboardBatch) =>
  `/trace/${encodeURIComponent(batch.traceCode)}`

const recentColumns: ColumnsType<DashboardBatch> = [
  {
    title: '批次编号',
    dataIndex: 'batchNo',
    width: 210,
    render: (value: string, row) => <Link to={batchPath(row)}>{value}</Link>,
  },
  { title: '药材', dataIndex: 'herbName', width: 90 },
  {
    title: '阶段',
    dataIndex: 'stage',
    width: 100,
    render: (stage: DashboardBatch['stage']) => <StageTag stage={stage} />,
  },
  {
    title: '审核',
    dataIndex: 'auditStatus',
    width: 100,
    render: (status: DashboardBatch['auditStatus']) => <AuditTag status={status} />,
  },
  {
    title: '风险',
    dataIndex: 'riskLevel',
    width: 100,
    render: (level: DashboardBatch['riskLevel']) => <RiskTag level={level} />,
  },
  { title: '种植组织', dataIndex: 'growerName', ellipsis: true },
  {
    title: '最近更新',
    dataIndex: 'updatedAt',
    width: 160,
    render: formatDashboardTime,
  },
]

const pendingColumns: ColumnsType<DashboardBatch> = [
  { title: '药材', dataIndex: 'herbName', width: 80 },
  { title: '批次编号', dataIndex: 'batchNo', width: 200 },
  {
    title: '操作',
    key: 'action',
    width: 90,
    render: (_, row) => <Link to={batchPath(row)}>查看并审核</Link>,
  },
]

export default function Dashboard() {
  const { token } = theme.useToken()
  const { session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const query = useDashboardOverview()
  const data = query.data

  const today = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'long',
  }).format(new Date())

  // 数字直接来自 Query 数据，不再复制到 state。
  const cards = data ? [
    {
      title: '批次总数',
      value: data.summary.totalBatches,
      hint: '当前全部登记批次',
      accent: 'green',
    },
    {
      title: '待审核批次',
      value: data.summary.pendingAuditBatches,
      hint: '当前审核状态为待审核',
      accent: 'gold',
    },
    {
      title: '风险标记批次',
      value: data.summary.riskBatches,
      hint: '现有低 / 中 / 高风险标记',
      accent: 'red',
    },
    {
      title: '仓储批次',
      value: data.summary.warehousingBatches,
      hint: '当前处于仓储阶段',
      accent: 'blue',
    },
  ] : []

  const categoryOption = {
    tooltip: { trigger: 'item' },
    // 窄屏外侧标签容易被裁切，统一在底部图例展示类别。
    legend: { bottom: 0, itemWidth: 14, itemHeight: 10 },
    series: [{
      type: 'pie',
      radius: ['40%', '68%'],
      center: ['50%', '43%'],
      label: { show: false },
      data: data?.categoryDistribution
        .filter((item) => item.count > 0)
        .map((item) => ({
          name: HERB_CATEGORY_LABEL[item.category],
          value: item.count,
        })) ?? [],
    }],
  } satisfies DashboardChartOption

  const stageOption = {
    color: [token.colorPrimary],
    tooltip: { trigger: 'axis' },
    grid: { left: 45, right: 20, top: 35, bottom: 60 },
    xAxis: {
      type: 'category',
      axisLabel: { interval: 0, rotate: 30, fontSize: 11 },
      data: data?.stageDistribution.map((item) => STAGE_LABEL[item.stage]) ?? [],
    },
    yAxis: { type: 'value', name: '批次', minInterval: 1 },
    series: [{
      type: 'bar',
      barMaxWidth: 36,
      data: data?.stageDistribution.map((item) => item.count) ?? [],
    }],
  } satisfies DashboardChartOption

  return <Layout className="admin-dashboard">
    <Sider
      width={220}
      className="admin-dashboard__sider"
      breakpoint="lg"
      collapsedWidth={72}
    >
      <div className="admin-dashboard__brand">
        <MedicineBoxOutlined className="admin-dashboard__brand-icon" />
        <div className="admin-dashboard__brand-text">
          <span className="admin-dashboard__brand-name">良木药谷</span>
          <span className="admin-dashboard__brand-sub">管理员控制台</span>
        </div>
      </div>

      <nav className="admin-dashboard__nav" aria-label="管理员导航">
        {menus.map((item) => <Link
          key={item.path}
          to={item.path}
          aria-label={item.label}
          title={item.label}
          aria-current={location.pathname === item.path ? 'page' : undefined}
          className={`admin-dashboard__nav-item ${location.pathname === item.path ? 'is-active' : ''
            }`}
        >
          {item.icon}<span>{item.label}</span>
        </Link>)}
      </nav>
    </Sider>

    <Layout>
      <Header className="admin-dashboard__header">
        <Flex
          align="center"
          justify="space-between"
          wrap
          gap={12}
          style={{ width: '100%' }}
        >
          <Breadcrumb items={[{ title: '管理员端' }, { title: '数据概览' }]} />
          <Space wrap>
            <Text type="secondary">{today}</Text>
            <MessageBell />
            <Link to="/profile" className="admin-dashboard__user-trigger">
              <Space>
                <Avatar
                  style={{ backgroundColor: token.colorPrimary }}
                  icon={<UserOutlined />}
                />
                <Text>{session?.displayName ?? '—'}</Text>
              </Space>
            </Link>
          </Space>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <div className="admin-dashboard__welcome">
          <div>
            <Title level={3} style={{ margin: 0 }}>批次数据概览</Title>
            <Paragraph
              type="secondary"
              style={{ marginTop: 8, marginBottom: 0 }}
            >
              查看当前批次状态、品类分布与待审核事项，不包含订单或支付统计。
            </Paragraph>
          </div>
          <Space wrap>
            <Button
              icon={<AuditOutlined />}
              onClick={() => navigate('/admin/herbs')}
            >
              药材管理
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={query.isFetching}
              onClick={() => { void query.refetch() }}
            >
              刷新统计
            </Button>
          </Space>
        </div>

        {query.isError && <Alert
          type="error"
          showIcon
          title="统计加载失败"
          description={query.error.message}
          action={<Button onClick={() => { void query.refetch() }}>重试</Button>}
        />}

        {query.isPending && <div className="admin-dashboard__loading">
          <Spin /> <Text type="secondary">正在读取统计…</Text>
        </div>}

        {data && <>
          <Paragraph type="secondary">
            {data.mode === 'api'
              ? '数据来自 PostgreSQL'
              : '离线演示：统计来自本浏览器样例与覆盖层'}
            {' · 统计生成于 '}{formatDashboardTime(data.generatedAt)}
            {query.isError && ' · 当前保留上次成功数据，请重试获取最新统计'}
          </Paragraph>

          <Row gutter={[16, 16]} className="admin-dashboard__summary-row">
            {cards.map((card) => <Col xs={24} sm={12} lg={6} key={card.title}>
              <Card
                variant="borderless"
                className={`admin-dashboard__stat-card admin-dashboard__stat-card--${card.accent}`}
              >
                <Text type="secondary" className="admin-dashboard__stat-title">
                  {card.title}
                </Text>
                <Statistic value={card.value} suffix="批" />
                <Text type="secondary" className="admin-dashboard__stat-hint">
                  {card.hint}
                </Text>
              </Card>
            </Col>)}
          </Row>

          <Row gutter={[16, 16]} className="admin-dashboard__section">
            <Col xs={24} lg={12}>
              <Card
                title="药材类别分布（当前）"
                variant="borderless"
                className="admin-dashboard__chart-card"
              >
                {data.summary.totalBatches === 0
                  ? <Empty description="暂无批次" />
                  : <ChartPanel option={categoryOption} />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card
                title="批次阶段分布（当前）"
                variant="borderless"
                className="admin-dashboard__chart-card"
              >
                {data.summary.totalBatches === 0
                  ? <Empty description="暂无批次" />
                  : <ChartPanel option={stageOption} />}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} className="admin-dashboard__section">
            <Col xs={24}>
              <Card
                title="最近更新批次（最多 6 条）"
                variant="borderless"
                extra={<Link to="/admin/herbs">查看全部</Link>}
              >
                <Table<DashboardBatch>
                  rowKey="id"
                  size="small"
                  columns={recentColumns}
                  dataSource={data.recentBatches}
                  pagination={false}
                  scroll={{ x: 1000 }}
                  locale={{ emptyText: '暂无批次' }}
                />
              </Card>
            </Col>
            <Col xs={24}>
              <Card
                title="待审核批次（最近 5 条）"
                variant="borderless"
                extra={<Text type="secondary">
                  共 {data.summary.pendingAuditBatches} 批
                </Text>}
              >
                <Table<DashboardBatch>
                  rowKey="id"
                  size="small"
                  columns={pendingColumns}
                  dataSource={data.pendingBatches}
                  pagination={false}
                  scroll={{ x: 450 }}
                  locale={{ emptyText: '暂无待审核批次' }}
                />
              </Card>
            </Col>
          </Row>
        </>}
      </Content>
    </Layout>
  </Layout>
}
