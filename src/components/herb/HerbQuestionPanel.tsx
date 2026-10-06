import { useState } from 'react'
import { Alert, Button, Card, Divider, Input, Space, Tag, Typography } from 'antd'
import { CommentOutlined } from '@ant-design/icons'
import { useHerbQuestion } from '../../hooks/useHerbQuestion'
import type { HerbBatch } from '../../types/herb'

const { Text, Paragraph } = Typography

const examples = [
    '本批次登记产地在哪里？',
    '这味药材的植物来源是什么？',
    '本批次目前处于什么阶段？',
]

export default function HerbQuestionPanel({ batch }: { batch: HerbBatch }) {
    // 保存用户输入的问题
    const [question, setQuestion] = useState('')
    // 调用Hook，拿到请求方法、状态、停止函数、错误信息
    const { mutation, ask, stop, stopped, error } = useHerbQuestion(batch.id)
    const reply = mutation.data // AI返回的完整回答对象

    const handleAsk = async () => {
        try {
            await ask(question)
        } catch {
            // 异常交给UI层error展示，这里不额外弹消息
        }
    }


    return (
        <Card
            title={
                <Space>
                    <CommentOutlined />
                    <span>问问 AI</span>
                </Space>
            }
            variant="borderless"
            style={{ marginTop: 16 }}
        >
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <Alert
                    type="info"
                    showIcon
                    title="基于当前批次资料与小型药材知识库回答"
                    description="通用知识不等于本批次检测结果；不提供诊断、用量或治疗建议。"
                />

                <Space wrap>
                    {examples.map((example) => (
                        <Button
                            key={example}
                            size="small"
                            disabled={mutation.isPending}
                            onClick={() => setQuestion(example)}
                        >
                            {example}
                        </Button>
                    ))}
                </Space>

                <Input.TextArea
                    aria-label="资料问答问题"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={`询问 ${batch.herbName} 的批次资料或药材背景`}
                    maxLength={500}
                    showCount
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    disabled={mutation.isPending}
                />

                <Space wrap>
                    <Button
                        type="primary"
                        loading={mutation.isPending}
                        disabled={mutation.isPending || question.trim().length < 2}
                        onClick={() => void handleAsk()}
                    >
                        提问
                    </Button>

                    {mutation.isPending && (
                        <Button onClick={stop} disabled={stopped}>
                            停止回答
                        </Button>
                    )}

                    <Text type="secondary">单轮问答，不自动重试</Text>
                </Space>

                {stopped && (
                    <Alert
                        type="warning"
                        showIcon
                        title="已请求停止回答"
                        description="不会自动重新调用模型；已产生的上游费用不一定退还。"
                    />
                )}

                {error && (
                    <Alert
                        type="error"
                        showIcon
                        title={error.message}
                        description="保留了你的问题，可以修改后手动再次提问。"
                    />
                )}

                {reply && (
                    <div style={{ width: '100%' }}>
                        <Space wrap>
                            <Tag color={reply.status === 'answered' ? 'green' : 'orange'}>
                                {reply.status === 'answered' ? '资料回答' : '资料不足或超出范围'}
                            </Tag>

                            {reply.mode === 'demo' ? (
                                <Tag color="gold">本地档案演示 · 未调用 AI</Tag>
                            ) : (
                                <Text type="secondary">
                                    BM25 检索 · {reply.modelName ?? '未调用模型'}
                                </Text>
                            )}
                        </Space>

                        <Paragraph type="secondary" style={{ marginTop: 12 }}>
                            问题：{reply.question}
                        </Paragraph>

                        {/* 以纯文本渲染，React 自动转义；不执行模型返回的 HTML。 */}
                        <Paragraph
                            style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                        >
                            {reply.answer}
                        </Paragraph>

                        {reply.citations.length > 0 && (
                            <>
                                <Divider titlePlacement="start">回答依据</Divider>

                                <Space orientation="vertical" style={{ width: '100%' }}>
                                    {reply.citations.map((citation) => (
                                        <div key={citation.id} style={{ width: '100%' }}>
                                            <Tag>
                                                {citation.kind === 'batch' ? '批次事实' : '通用知识'}
                                            </Tag>
                                            <Text code>{citation.id}</Text>

                                            <div>
                                                {citation.url ? (
                                                    <Typography.Link
                                                        href={citation.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        {citation.title}
                                                    </Typography.Link>
                                                ) : (
                                                    <Text strong>{citation.title}</Text>
                                                )}
                                            </div>

                                            <Text type="secondary">{citation.publisher}</Text>
                                            <Paragraph style={{ marginTop: 4 }}>
                                                {citation.excerpt}
                                            </Paragraph>
                                        </div>
                                    ))}
                                </Space>
                            </>
                        )}
                    </div>
                )}
            </Space>
        </Card>
    )
}