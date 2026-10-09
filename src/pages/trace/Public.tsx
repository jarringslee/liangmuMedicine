import { useState } from 'react'
import {
    Alert,
    Button,
    Card,
    Descriptions,
    Empty,
    Input,
    Result,
    Space,
    Tag,
    Timeline,
    Typography,
    message,
} from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { authMode } from '../../config/api'
import PageLoading from '../../components/PageLoading'
import { usePublicTrace } from '../../hooks/usePublicTrace'
import {
    EVENT_TYPE_LABEL,
    HERB_CATEGORY_LABEL,
    RISK_LABEL,
    STAGE_LABEL,
} from '../../types/herb'
import { extractTraceCode, isTraceCode } from '../../utils/traceCode'
import './Public.less'

const { Title, Text } = Typography

// ISO 时间按业务时区展示，不依赖浏览设备所在时区。
const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
})

function formatTime(value: string) {
    return timeFormatter.format(new Date(value))
}

export default function PublicTracePage() {
    const { traceCode } = useParams<{ traceCode: string }>()
    const navigate = useNavigate()
    const code = (traceCode ?? '').trim().toUpperCase()
    const validCode = isTraceCode(code)

    const query = usePublicTrace(traceCode)

    // 输入值是页面状态；数据、加载和错误状态由 Query 管理。
    const [input, setInput] = useState(code)
    const [messageApi, contextHolder] = message.useMessage()

    const searchPublic = (value: string) => {
        const target = extractTraceCode(value)

        if (!target) {
            void messageApi.warning('请输入完整溯源码或溯源链接')
            return
        }

        if (target === code) {
            // 相同编号也允许主动重新检查公开资格。
            void query.refetch()
            return
        }

        navigate(`/public/trace/${encodeURIComponent(target)}`)
    }

    const openFullDetail = () => {
        const path = `/trace/${encodeURIComponent(code)}`
        navigate(`/login?redirect=${encodeURIComponent(path)}`)
    }

    // 普通渲染辅助函数；这里不调用 Hook。
    function renderArchive() {
        // disabled 的 Query 也可能 isPending，必须先判断编号是否合法。
        if (!validCode) {
            return (
                <Result
                    status="warning"
                    title="溯源码格式不正确"
                    subTitle="请在上方输入完整溯源码，例如 YM-TRACE-2026-0001。"
                />
            )
        }

        if (query.isPaused) {
            return (
                <Result
                    status="warning"
                    title="网络暂不可用"
                    subTitle="恢复网络后会继续查询；当前不展示未重新核验的档案。"
                />
            )
        }

        // 重新请求期间也隐藏旧数据，避免展示旧审核状态。
        if (query.isPending || query.isFetching) {
            return <PageLoading label="正在查询公开档案…" height={200} />
        }

        if (query.isError) {
            return (
                <Result
                    status="warning"
                    title="公开档案查询失败"
                    subTitle="请稍后重试。查询失败并不代表批次不存在。"
                    extra={
                        <Button onClick={() => void query.refetch()}>
                            重新查询
                        </Button>
                    }
                />
            )
        }

        const batch = query.data

        if (!batch) {
            return (
                <Result
                    status="404"
                    title="档案不存在或暂不可公开"
                    subTitle="请核对溯源码，或联系平台确认档案公开情况。"
                />
            )
        }

        return (
            <div className="public-trace__cards">
                <Card
                    title={
                        <Title level={3} style={{ margin: 0 }}>
                            {batch.herbName}
                        </Title>
                    }
                >
                    <Space wrap style={{ marginBottom: 20 }}>
                        <Tag color="green">已审核登记</Tag>
                        <Tag>{HERB_CATEGORY_LABEL[batch.category]}</Tag>
                        <Tag>阶段：{STAGE_LABEL[batch.stage]}</Tag>
                        <Tag>风险标记：{RISK_LABEL[batch.riskLevel]}</Tag>
                    </Space>

                    <Descriptions
                        column={{ xs: 1, sm: 2 }}
                        layout="vertical"
                        items={[
                            {
                                key: 'batchNo',
                                label: '批次号',
                                children: <Text copyable>{batch.batchNo}</Text>,
                            },
                            {
                                key: 'traceCode',
                                label: '溯源码',
                                children: <Text copyable>{batch.traceCode}</Text>,
                            },
                            {
                                key: 'origin',
                                label: '产地',
                                children: [
                                    batch.origin.province,
                                    batch.origin.city,
                                    batch.origin.district,
                                ].filter(Boolean).join(' / '),
                            },
                            {
                                key: 'grower',
                                label: '种植机构',
                                children: batch.growerName,
                            },
                            {
                                key: 'processor',
                                label: '加工机构',
                                children: batch.processorName ?? '暂无公开信息',
                            },
                            {
                                key: 'plantingDate',
                                label: '种植开始日期',
                                children: batch.plantingStartDate,
                            },
                            {
                                key: 'createdAt',
                                label: '建档时间',
                                children: formatTime(batch.createdAt),
                            },
                            {
                                key: 'updatedAt',
                                label: '档案更新时间',
                                children: formatTime(batch.updatedAt),
                            },
                        ]}
                    />
                </Card>

                <Card title="公开溯源节点 · 最新在前">
                    {batch.events.length === 0 ? (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="暂无公开节点"
                        />
                    ) : (
                        <Timeline
                            items={batch.events.map((event, index) => ({
                                key: `${event.type}:${event.occurredAt}:${index}`,
                                title: EVENT_TYPE_LABEL[event.type],
                                content: (
                                    <Space orientation="vertical" size={4}>
                                        <Text type="secondary">
                                            {formatTime(event.occurredAt)}
                                        </Text>
                                        {event.fromStage && event.toStage ? (
                                            <Text>
                                                {STAGE_LABEL[event.fromStage]}
                                                {' → '}
                                                {STAGE_LABEL[event.toStage]}
                                            </Text>
                                        ) : null}
                                    </Space>
                                ),
                            }))}
                        />
                    )}

                    {batch.eventsTruncated ? (
                        <Text type="secondary">
                            仅展示最近 100 个公开节点。
                        </Text>
                    ) : null}
                </Card>
            </div>
        )
    }

    return (
        <main className="public-trace">
            {contextHolder}

            <div className="public-trace__content">
                <header className="public-trace__header">
                    <div>
                        <Title level={2} style={{ margin: 0 }}>
                            良木药谷 · 公开溯源
                        </Title>
                        <Text type="secondary">
                            扫码、访问链接或输入溯源码均可查询公开档案
                        </Text>
                    </div>

                    <Button
                        type="primary"
                        disabled={!validCode}
                        onClick={openFullDetail}
                    >
                        登录查看完整详情与 AI
                    </Button>
                </header>

                <Input.Search
                    aria-label="查询公开溯源档案"
                    placeholder="输入溯源码或完整溯源链接"
                    value={input}
                    maxLength={500}
                    onChange={(event) => setInput(event.target.value)}
                    onSearch={searchPublic}
                    enterButton="查询"
                />

                <Alert
                    type="info"
                    showIcon
                    title="公开信息说明"
                    description={
                        `${authMode === 'demo' ? '当前为离线演示样例。' : ''}` +
                        '公开登记信息和风险标记不构成质量认证或医疗建议。' +
                        '登录后仍按角色与组织权限查看完整详情、使用 AI。'
                    }
                />

                {renderArchive()}
            </div>
        </main>
    )
}