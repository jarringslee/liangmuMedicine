import { useMemo, useState } from 'react'
import {
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Flex,
  Input,
  Layout,
  Row,
  Select,
  Space,
  Spin,
  Typography,
  message,
  theme,
} from 'antd'
import {
  EnvironmentOutlined,
  EyeOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  ScanOutlined,
  ShopOutlined,
  TagsOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { useHerbBatches } from '../../../hooks/useHerbBatches'
import { AuditTag, RiskTag, StageTag } from '../../../components/herb/herbTags'
import QrScanDrawer from '../../../components/herb/QrScanDrawer'
import TraceQuickViewModal from '../../../components/herb/TraceQuickViewModal'
import { getByTraceCode } from '../../../services/herbStorage'
import {
  HERB_CATEGORY_LABEL,
  STAGE_LABEL,
  type HerbBatch,
  type HerbCategory,
  type Stage,
} from '../../../types/herb'
import '../../dashboard/index.less'
import './herbs.less'

const { Header, Content } = Layout
const { Title, Text, Paragraph } = Typography

const CATEGORY_OPTIONS: { value: HerbCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部类别' },
  ...(Object.keys(HERB_CATEGORY_LABEL) as HerbCategory[]).map((k) => ({
    value: k,
    label: HERB_CATEGORY_LABEL[k],
  })),
]

const STAGE_OPTIONS: { value: Stage | 'all'; label: string }[] = [
  { value: 'all', label: '全部阶段' },
  ...(Object.keys(STAGE_LABEL) as Stage[]).map((k) => ({ value: k, label: STAGE_LABEL[k] })),
]

function formatOrigin(b: HerbBatch): string {
  return [b.origin.province, b.origin.city, b.origin.district].filter(Boolean).join(' · ')
}

export default function BuyerHerbsPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const { session, logout } = useAuth()
  const { data, loading } = useHerbBatches()

  const [scanOpen, setScanOpen] = useState(false)
  const [quickViewBatch, setQuickViewBatch] = useState<HerbBatch | null>(null)
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<HerbCategory | 'all'>('all')
  const [stage, setStage] = useState<Stage | 'all'>('all')

  /** 采购商只能看到已审核通过的批次 */
  const approved = useMemo(() => data.filter((b) => b.auditStatus === 'approved'), [data])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return approved.filter((b) => {
      if (category !== 'all' && b.category !== category) return false
      if (stage !== 'all' && b.stage !== stage) return false
      if (!kw) return true
      return (
        b.herbName.toLowerCase().includes(kw) ||
        b.batchNo.toLowerCase().includes(kw) ||
        b.traceCode.toLowerCase().includes(kw) ||
        b.growerName.toLowerCase().includes(kw) ||
        b.origin.province.toLowerCase().includes(kw) ||
        b.origin.city.toLowerCase().includes(kw)
      )
    })
  }, [approved, category, stage, keyword])

  const handleScanResult = async (code: string) => {
    setScanOpen(false)
    try {
      const found = await getByTraceCode(code)
      if (!found) {
        message.error(`未找到该溯源码：${code}`)
        return
      }
      if (found.auditStatus !== 'approved') {
        message.warning('该批次尚未通过审核，暂不展示完整溯源信息')
      }
      setQuickViewBatch(found)
    } catch (e) {
      message.error(`查询失败：${(e as Error).message}`)
    }
  }

  const handleViewFull = (b: HerbBatch) => {
    setQuickViewBatch(null)
    navigate(`/trace/${b.traceCode}`, { state: { fromInternal: true } })
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Layout className="admin-dashboard">
      <Header className="admin-dashboard__header">
        <Flex align="center" justify="space-between" style={{ width: '100%' }}>
          <Space size="middle" wrap>
            <MedicineBoxOutlined style={{ fontSize: 22, color: token.colorPrimary }} />
            <Title level={4} style={{ margin: 0 }}>
              良木药谷 · 采购商端
            </Title>
          </Space>
          <Space size="large">
            <Button
              type="primary"
              icon={<ScanOutlined />}
              onClick={() => setScanOpen(true)}
            >
              溯源查询
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'profile',
                    icon: <UserOutlined />,
                    label: '个人中心',
                    onClick: () => navigate('/profile'),
                  },
                  { type: 'divider' },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    danger: true,
                    onClick: handleLogout,
                  },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <button type="button" className="buyer-herbs__user-trigger">
                <Space>
                  <Avatar style={{ backgroundColor: token.colorPrimary }} icon={<UserOutlined />} />
                  <div style={{ lineHeight: 1.2, textAlign: 'left' }}>
                    <div>
                      <Text strong>{session?.displayName ?? '—'}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {session?.roleLabel ?? '采购商'}
                    </Text>
                  </div>
                </Space>
              </button>
            </Dropdown>
          </Space>
        </Flex>
      </Header>

      <Content className="admin-dashboard__content">
        <Breadcrumb
          style={{ marginBottom: 16 }}
          items={[
            { title: '采购商端' },
            { title: <span style={{ color: token.colorText }}>药材浏览</span> },
          ]}
        />

        <div className="buyer-herbs__hero">
          <div>
            <Title level={3}>欢迎，{session?.displayName ?? '采购商'}</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
              浏览已审核通过的药材批次，或通过<strong>「溯源查询」</strong>扫码、上传图片、手动输入溯源码以查看溯源详情。
            </Paragraph>
          </div>
          <div className="buyer-herbs__hero-actions">
            <Button icon={<ScanOutlined />} type="primary" onClick={() => setScanOpen(true)}>
              扫码 / 输码 查询
            </Button>
          </div>
        </div>

        <div className="buyer-herbs__toolbar">
          <Input.Search
            allowClear
            placeholder="搜索 药材 / 批次号 / 溯源码 / 种植商 / 产地"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => setKeyword(v)}
            style={{ width: 320 }}
          />
          <Select
            value={category}
            options={CATEGORY_OPTIONS}
            onChange={(v) => setCategory(v)}
            style={{ width: 140 }}
          />
          <Select
            value={stage}
            options={STAGE_OPTIONS}
            onChange={(v) => setStage(v)}
            style={{ width: 140 }}
          />
          <span className="buyer-herbs__toolbar-spacer" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            共 {filtered.length} 条 / 已审核 {approved.length} 条
          </Text>
        </div>

        {loading ? (
          <Flex justify="center" style={{ padding: 60 }}>
            <Spin />
          </Flex>
        ) : filtered.length === 0 ? (
          <Card bordered={false}>
            <Empty
              className="buyer-herbs__empty"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="未找到匹配的药材批次，请调整筛选条件"
            />
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map((b) => (
              <Col xs={24} sm={12} md={8} xl={6} key={b.id}>
                <Card
                  className="buyer-herbs__card"
                  bordered={false}
                  hoverable
                  onClick={() => navigate(`/trace/${b.traceCode}`, { state: { fromInternal: true } })}
                  cover={
                    <div
                      className="buyer-herbs__card-cover"
                      role="img"
                      aria-label={b.herbName}
                      style={{
                        backgroundImage: `url(${b.coverImageUrl ?? '/images/herbs/placeholder.svg'})`,
                      }}
                    />
                  }
                >
                  <div className="buyer-herbs__card-title">
                    <Title level={5} ellipsis>
                      {b.herbName}
                    </Title>
                    <StageTag stage={b.stage} />
                  </div>

                  <Space size={4} wrap>
                    <AuditTag status={b.auditStatus} />
                    <RiskTag level={b.riskLevel} />
                    <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>
                      {HERB_CATEGORY_LABEL[b.category]}
                    </span>
                  </Space>

                  <div className="buyer-herbs__card-meta">
                    <Text type="secondary" ellipsis>
                      <EnvironmentOutlined />
                      {formatOrigin(b)}
                    </Text>
                    <Text type="secondary" ellipsis>
                      <ShopOutlined />
                      {b.growerName}
                    </Text>
                    <Text type="secondary" ellipsis>
                      <TagsOutlined />
                      {b.batchNo}
                    </Text>
                  </div>

                  <div className="buyer-herbs__card-foot">
                    <span className="buyer-herbs__card-trace" title={b.traceCode}>
                      {b.traceCode}
                    </span>
                    <Link
                      to={`/trace/${b.traceCode}`}
                      state={{ fromInternal: true }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button type="link" size="small" icon={<EyeOutlined />}>
                        查看详情
                      </Button>
                    </Link>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Content>

      <QrScanDrawer
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={handleScanResult}
      />

      <TraceQuickViewModal
        open={quickViewBatch !== null}
        batch={quickViewBatch}
        role={session?.role ?? 'buyer'}
        onClose={() => setQuickViewBatch(null)}
        onViewFull={handleViewFull}
      />
    </Layout>
  )
}
