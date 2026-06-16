import { useMemo, type ReactNode } from 'react'
import {
  Alert,
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Layout,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AlertOutlined,
  AuditOutlined,
  BarChartOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  MedicineBoxOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TransactionOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import ReactECharts from 'echarts-for-react'
import { mockBatches, type BatchRow } from '../../mock/dashboard/batch'
import { mockWarnings, type WarningItem } from '../../mock/dashboard/warning'
import { purchaseTrend, categoryPie, flowBar, healthGauge } from '../../mock/dashboard/chart'
import type { DashboardMenuIconKey, SummaryIconKey } from '../../mock/dashboard/overview'
import {
  aiAnalysisCopy,
  dashboardMenuItems,
  platformFooterNote,
  secondaryStats,
  siderReportProgressPercent,
  summaryCards,
} from '../../mock/dashboard/overview'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { MessageBell } from '../../components/MessageBell'
import { pendingInspectionTasks } from '../../mock/task/inspection'
import './index.less'

dayjs.locale('zh-cn')

const { Header, Sider, Content } = Layout
const { Title, Paragraph, Text } = Typography

const summaryIconMap: Record<SummaryIconKey, ReactNode> = {
  fileSearch: <FileSearchOutlined />,
  medicineBox: <MedicineBoxOutlined />,
  audit: <AuditOutlined />,
  alert: <AlertOutlined />,
  team: <TeamOutlined />,
  transaction: <TransactionOutlined />,
  safetyCertificate: <SafetyCertificateOutlined />,
  thunderbolt: <ThunderboltOutlined />,
}

const menuIconMap: Record<DashboardMenuIconKey, ReactNode> = {
  dashboard: <DashboardOutlined />,
  medicineBox: <MedicineBoxOutlined />,
  shop: <ShopOutlined />,
  experiment: <ExperimentOutlined />,
  truck: <TruckOutlined />,
  fileSearch: <FileSearchOutlined />,
  safetyCertificate: <SafetyCertificateOutlined />,
  setting: <SettingOutlined />,
}

function statusTag(status: BatchRow['status']) {
  const map = {
    normal: { color: 'success', text: '正常' },
    pending: { color: 'warning', text: '待审' },
    risk: { color: 'error', text: '风险' },
  }
  const m = map[status]
  return <Tag color={m.color}>{m.text}</Tag>
}

function riskTag(level: WarningItem['level']) {
  const map = {
    high: { color: 'red', text: '高风险' },
    medium: { color: 'orange', text: '中风险' },
    low: { color: 'blue', text: '低风险' },
  }
  const x = map[level]
  return <Tag color={x.color}>{x.text}</Tag>
}

const batchColumns: ColumnsType<BatchRow> = [
  { title: '批次编号', dataIndex: 'batchNo', key: 'batchNo', width: 200, ellipsis: true },
  { title: '药材', dataIndex: 'herbName', key: 'herbName', width: 88 },
  { title: '当前环节', dataIndex: 'stage', key: 'stage', width: 110 },
  { title: '责任主体', dataIndex: 'supplier', key: 'supplier', ellipsis: true },
  { title: '最近更新', dataIndex: 'updatedAt', key: 'updatedAt', width: 155 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 88,
    render: (s: BatchRow['status']) => statusTag(s),
  },
]

function DashboardInner() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()

  const lineOption = useMemo(
    () => ({
      color: [token.colorPrimary],
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 32, bottom: 32 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: [...purchaseTrend.xAxisData],
      },
      yAxis: { type: 'value', name: '万元' },
      series: [
        {
          name: purchaseTrend.seriesName,
          type: 'line',
          smooth: true,
          areaStyle: { opacity: 0.08 },
          data: [...purchaseTrend.seriesData],
        },
      ],
    }),
    [token.colorPrimary],
  )

  const pieOption = useMemo(
    () => ({
      color: [...categoryPie.colors],
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, left: 'center' },
      series: [
        {
          name: '品类占比',
          type: 'pie',
          radius: ['42%', '68%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6 },
          label: { formatter: '{b}\n{d}%' },
          data: categoryPie.data.map((d) => ({ ...d })),
        },
      ],
    }),
    [],
  )

  const barOption = useMemo(
    () => ({
      color: ['#2f6f4e'],
      tooltip: { trigger: 'axis' },
      grid: { left: 48, right: 24, top: 24, bottom: 48 },
      xAxis: {
        type: 'category',
        data: [...flowBar.categories],
      },
      yAxis: { type: 'value', name: '批次' },
      series: [
        {
          type: 'bar',
          barMaxWidth: 36,
          data: [...flowBar.values],
        },
      ],
    }),
    [],
  )

  const funnelHealth = useMemo(
    () => ({
      series: [
        {
          type: 'gauge',
          center: ['50%', '58%'],
          radius: '88%',
          min: 0,
          max: 100,
          splitNumber: 10,
          axisLine: {
            lineStyle: {
              width: 14,
              color: [
                [0.3, '#ff4d4f'],
                [0.7, '#faad14'],
                [1, '#52c41a'],
              ],
            },
          },
          pointer: { length: '70%', width: 5 },
          axisTick: { distance: -14, length: 8 },
          splitLine: { distance: -18, length: 18 },
          axisLabel: { distance: 20 },
          detail: { valueAnimation: true, formatter: '{value}', fontSize: 22, offsetCenter: [0, '72%'] },
          data: [{ value: healthGauge.value, name: healthGauge.name }],
        },
      ],
    }),
    [],
  )

  return (
    <Layout className="admin-dashboard">
      <Sider width={220} className="admin-dashboard__sider" breakpoint="lg" collapsedWidth={72}>
        <div className="admin-dashboard__brand">
          <MedicineBoxOutlined className="admin-dashboard__brand-icon" />
          <div className="admin-dashboard__brand-text">
            <span className="admin-dashboard__brand-name">良木药谷</span>
            <span className="admin-dashboard__brand-sub">管理员控制台</span>
          </div>
        </div>
        <nav className="admin-dashboard__nav">
          {dashboardMenuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`admin-dashboard__nav-item ${
                (item.path && location.pathname.startsWith(item.path)) ||
                (item.key === 'dash' && location.pathname === '/dashboard')
                  ? 'is-active'
                  : ''
              }`}
              onClick={() => {
                if (item.path) navigate(item.path)
              }}
            >
              {menuIconMap[item.iconKey]}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-dashboard__sider-foot">
          <Progress percent={siderReportProgressPercent} size="small" status="active" showInfo={false} />
          <Text type="secondary" className="admin-dashboard__sider-foot-text">
            本月数据上报进度（目标）
          </Text>
        </div>
      </Sider>

      <Layout>
        <Header className="admin-dashboard__header">
          <Flex align="center" justify="space-between" style={{ width: '100%' }}>
            <Space size="middle" wrap>
              <Breadcrumb
                items={[
                  { title: '管理员端' },
                  { title: <span style={{ color: token.colorText }}>数据概览</span> },
                ]}
              />
            </Space>
            <Space size="large">
              <Text type="secondary">
                {dayjs().format('YYYY年MM月DD日 dddd')}
              </Text>
              <MessageBell />
              <Link to="/profile" className="admin-dashboard__user-trigger">
                <Space>
                  <Avatar style={{ backgroundColor: token.colorPrimary }} icon={<UserOutlined />} />
                  <div style={{ lineHeight: 1.2 }}>
                    <div>
                      <Text strong>{session?.displayName ?? '—'}</Text>
                    </div>
                
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {session?.email ?? '—'}
                    </Text>
                  </div>
                </Space>
              </Link>
            </Space>
          </Flex>
        </Header>

        <Content className="admin-dashboard__content">
          <div className="admin-dashboard__welcome">
            <div>
              <Title level={3} style={{ margin: 0 }}>
                中药材全链路智能溯源管理平台
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8, maxWidth: 720 }}>
                打通种植、加工、采购、销售与质检数据，支持批次级追溯、风险预警与链上存证。
              </Paragraph>
            </div>
            <Space wrap>
              <Button type="primary" icon={<RocketOutlined />}>
                新建抽检任务
              </Button>
              <Button icon={<BarChartOutlined />}>导出月报</Button>
            </Space>
          </div>

          <Row gutter={[16, 16]} className="admin-dashboard__summary-row">
            {summaryCards.map((card) => (
              <Col xs={24} sm={12} lg={6} xl={6} key={card.title}>
                <Card className={`admin-dashboard__stat-card admin-dashboard__stat-card--${card.accent}`} bordered={false}>
                  <Flex justify="space-between" align="flex-start">
                    <div>
                      <Text type="secondary" className="admin-dashboard__stat-title">
                        {card.title}
                      </Text>
                      <div className="admin-dashboard__stat-value-wrap">
                        <Statistic value={card.value} suffix={card.suffix} valueStyle={{ fontSize: 26, fontWeight: 600 }} />
                      </div>
                      <Text type="secondary" className="admin-dashboard__stat-hint">
                        {card.hint}
                      </Text>
                    </div>
                    <div className="admin-dashboard__stat-icon">{summaryIconMap[card.iconKey]}</div>
                  </Flex>
                </Card>
              </Col>
            ))}
          </Row>

          <Card className="admin-dashboard__sub-stats" bordered={false}>
            <Row gutter={[16, 16]}>
              {secondaryStats.map((s) => (
                <Col xs={24} sm={12} md={6} key={s.label}>
                  <div className="admin-dashboard__sub-stat">
                    <Text type="secondary">{s.label}</Text>
                    <div className="admin-dashboard__sub-stat-value">{s.value}</div>
                    <Text type="secondary" className="admin-dashboard__sub-stat-trend">
                      {s.trend}
                    </Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={16}>
              <Card title="采购 / 合同备案趋势（万元）" bordered={false} className="admin-dashboard__chart-card">
                <ReactECharts option={lineOption} style={{ height: 320 }} notMerge lazyUpdate />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="药材品类结构" bordered={false} className="admin-dashboard__chart-card">
                <ReactECharts option={pieOption} style={{ height: 320 }} notMerge lazyUpdate />
              </Card>
            </Col>
            <Col xs={24} xl={14}>
              <Card title="各链路环节流转批次量（本月）" bordered={false} className="admin-dashboard__chart-card">
                <ReactECharts option={barOption} style={{ height: 320 }} notMerge lazyUpdate />
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title="链路健康度（综合评分）" bordered={false} className="admin-dashboard__chart-card">
                <ReactECharts option={funnelHealth} style={{ height: 320 }} notMerge lazyUpdate />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} lg={14}>
              <Card title="最近溯源批次" extra={<Button type="link">查看全部</Button>} bordered={false}>
                <Table<BatchRow>
                  size="small"
                  columns={batchColumns}
                  dataSource={mockBatches}
                  pagination={false}
                  scroll={{ x: 800 }}
                />
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card title="待办" bordered={false} className="admin-dashboard__todo-card">
                <List
                  dataSource={pendingInspectionTasks}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{item.title}</Text>
                            <Tag>{item.type}</Tag>
                          </Space>
                        }
                        description={<Text type="secondary">截止：{item.deadline}</Text>}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <Card title="高风险与异常批次预警" bordered={false}>
                <List
                  dataSource={mockWarnings}
                  renderItem={(item) => (
                    <List.Item className="admin-dashboard__warning-item">
                      <List.Item.Meta
                        avatar={<Avatar icon={<AlertOutlined />} style={{ background: token.colorError }} />}
                        title={
                          <Space wrap>
                            <Text strong>{item.name}</Text>
                            {riskTag(item.level)}
                            <Text type="secondary">· {item.time}</Text>
                          </Space>
                        }
                        description={item.issue}
                      />

                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            <Col xs={24} md={10}>
              <Card title="AI 智能分析摘要" bordered={false} className="admin-dashboard__ai-card">
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Alert
                    type="warning"
                    showIcon
                    message={aiAnalysisCopy.alertMessage}
                    description={aiAnalysisCopy.alertDescription}
                  />
                  <Paragraph style={{ marginBottom: 0 }}>
                    {aiAnalysisCopy.bodyLead}
                    <Text strong> {aiAnalysisCopy.bodyStrong}</Text>
                    {aiAnalysisCopy.bodyTail}
                  </Paragraph>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary">建议处置路径：</Text>
                  <Paragraph>
                    <Text>{aiAnalysisCopy.stepsText}</Text>
                  </Paragraph>
                  <Button type="primary" block icon={<ThunderboltOutlined />}>
                    生成风控简报（示例）
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>

          <Card bordered={false} className="admin-dashboard__footer-note">
            <Text type="secondary">{platformFooterNote}</Text>
          </Card>
        </Content>
      </Layout>
    </Layout >
  )
}

export default function Dashboard() {
  return <DashboardInner />
}
