import { useEffect, useRef } from 'react'
import { Alert, Button, Drawer, Input, Space, Tag, Typography } from 'antd'
import { CommentOutlined, SendOutlined } from '@ant-design/icons'
import { useAssistant } from '../../hooks/useAssistant'
import { assistantBatchPrefix } from '../../utils/assistant'
import AssistantMessages from './AssistantMessages'
import './assistant.less'

const { Text } = Typography

export default function AssistantDrawer() {
    const { open, batch, turns, draft, setDraft, isPending,
        historyLoading, historyError, historyMode, conversationBusy, reloadHistory,
        openAssistant, closeAssistant, removeBatch, send, stop } = useAssistant()
    const endRef = useRef<HTMLDivElement>(null)
    const valid = draft.trim().length >= 2 && draft.trim().length <= 500
    const blocked = historyLoading || !!historyError || conversationBusy
    const prefix = batch ? assistantBatchPrefix(batch) : ''

    useEffect(() => {
        if (open) endRef.current?.scrollIntoView({ block: 'nearest' })
    }, [open, turns])

    return <>
        <Button className="assistant-launcher" type="primary" icon={<CommentOutlined />}
            onClick={() => openAssistant(null)}>AI 助手</Button>
        <Drawer title="良木 AI 助手" open={open} onClose={closeAssistant}
            size={520} zIndex={1200} styles={{ body: { padding: 16 } }}>
            <div className="assistant-chat">
                <div className="assistant-context">
                    {batch ? <Space wrap>
                        <Tag closable onClose={removeBatch}>{batch.herbName} · {batch.batchNo}</Tag>
                        <Button size="small" onClick={() => setDraft((value) =>
                            value.startsWith(prefix) ? value : (prefix + value).slice(0, 500))}>插入批次前缀</Button>
                        <Text copyable={{ text: prefix }}>复制前缀</Text>
                        <Text type="secondary">可以普通聊天；批次问题按标签或明确编号查询。</Text>
                    </Space> : <Text type="secondary">可普通聊天，也可输入完整批次号；详情入口可带入标签。</Text>}
                </div>
                {historyLoading && <Text type="secondary">正在同步聊天记录…</Text>}
                {historyError && <Alert type="error" showIcon title="聊天记录加载失败"
                    description={historyError}
                    action={<Button size="small" onClick={reloadHistory}>重试加载</Button>} />}
                {conversationBusy && !isPending && <Text type="secondary">
                    服务器仍有一条提问在处理，稍后会自动补查记录，不会重复调用模型。
                </Text>}
                <div className="assistant-history" aria-live="polite">
                    <AssistantMessages turns={turns} busy={blocked}
                        retry={(request) => { void send(request) }} />
                    <div ref={endRef} />
                </div>
                <div className="assistant-composer">
                    <Input.TextArea aria-label="AI 助手问题" value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={batch ? '询问这个批次，或直接普通聊天' : '你好，怎么使用溯源系统？'}
                        maxLength={500} showCount autoSize={{ minRows: 2, maxRows: 5 }}
                        onPressEnter={(event) => {
                            // Shift+Enter 换行；中文输入法选词时不能误发送。
                            if (!event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault()
                                if (valid && !blocked) void send()
                            }
                        }} />
                    <Space style={{ marginTop: 12 }}>
                        <Button type="primary" icon={<SendOutlined />} loading={isPending}
                            disabled={!valid || blocked} onClick={() => { void send() }}>发送</Button>
                        {isPending && <Button onClick={stop}>停止回答</Button>}
                    </Space>
                    <div style={{ marginTop: 8 }}>
                        <Text type="secondary">{historyMode === 'api'
                            ? '保存本人历史，显示最近 40 轮；模型仅使用最多 4 轮相关历史。关闭不会删除记录。'
                            : historyMode === 'demo'
                                ? '静态演示：仅本次登录展示历史，不持久化，不调用 AI，不支持多轮推理。'
                                : '加载历史后可发送；关闭会停止本次未完成请求。'}</Text>
                    </div>
                </div>
            </div>
        </Drawer>
    </>
}
