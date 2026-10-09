import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Empty, Input, Layout, Space, Spin, Typography } from 'antd'
import { ArrowLeftOutlined, MessageOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { authMode } from '../../config/api'
import { useAuth } from '../../hooks/useAuth'
import { useChatContacts, useChatConversations, useChatHistory } from '../../hooks/useChat'
import { chatRoleLabels, type ChatTarget, type SendChatInput } from '../../types/chat'
import { getRoleNavigation } from '../../utils/roleNavigation'
import { formatNotificationTime } from '../../utils/notification'
import './index.less'

const { Header, Content } = Layout
const { Text, Title } = Typography

function ChatPanel({ target }: { target: ChatTarget }) {
  const { session } = useAuth()
  const { query, messages, send, read } = useChatHistory(target.id)
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(() => document.visibilityState === 'visible' && document.hasFocus())
  const end = useRef<HTMLDivElement>(null)
  const lastAttempt = useRef(0)
  const failedInput = useRef<SendChatInput | null>(null)
  const latestSequence = query.data?.pages[0]?.items.at(-1)?.sequence ?? 0
  const markRead = read.mutate
  const contact = query.data?.pages[0]?.contact ?? target.contact

  useEffect(() => {
    const check = () => setFocused(document.visibilityState === 'visible' && document.hasFocus())
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    window.addEventListener('blur', check)
    return () => { document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check); window.removeEventListener('blur', check) }
  }, [])
  useEffect(() => {
    // 只上报已拉取且正在查看的最新位置，后台标签不自动清未读。
    if (!focused || query.isError || latestSequence <= lastAttempt.current) return
    lastAttempt.current = latestSequence
    markRead(latestSequence)
  }, [focused, latestSequence, query.isError, markRead])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [latestSequence])

  function submit() {
    const content = draft.trim()
    if (!content || send.isPending || query.isError || query.isPending) return
    // 超时不代表服务器没保存；内容没改时重试同一个 UUID，避免重复消息。
    const input = failedInput.current?.content === content ? failedInput.current
      : { clientMessageId: crypto.randomUUID(), content }
    failedInput.current = input
    send.mutate(input, { onSuccess: () => { failedInput.current = null; setDraft('') } })
  }

  return <section className="human-chat__panel" aria-label="聊天会话">
    <div className="human-chat__panel-header">
      <div><Text strong>{contact.displayName}</Text><br />
        <Text type="secondary">{chatRoleLabels[contact.role]} · {contact.organizationName ?? '平台'} · {contact.username}</Text></div>
      <Button size="small" icon={<ReloadOutlined />} loading={query.isFetching}
        onClick={() => { void query.refetch() }}>刷新</Button>
    </div>
    {query.error && <Alert type="error" showIcon title="会话读取失败" description={query.error.message} />}
    <div className="human-chat__history" role="log" aria-live="polite">
      {query.isPending ? <Spin /> : query.isError ? <Empty description="无法读取会话，请重试" /> : <>
        {query.hasNextPage && <Button block type="link" loading={query.isFetchingNextPage}
          onClick={() => { void query.fetchNextPage() }}>加载更早消息</Button>}
        {!messages.length && <Empty description="还没有消息，可以开始沟通" />}
        {messages.map((item) => <article key={item.id}
          className={`human-chat__bubble ${item.senderId === session?.userId ? 'human-chat__bubble--self' : ''}`}>
          <Text type="secondary" className="human-chat__time">
            {item.senderId === session?.userId ? '我' : contact.displayName} · {formatNotificationTime(item.createdAt)}
          </Text>
          <div className="human-chat__text">{item.content}</div>
        </article>)}
      </>}
      <div ref={end} />
    </div>
    <div className="human-chat__composer">
      {send.error && <Alert type="error" showIcon title="发送未确认" description={`${send.error.message}；保留原文重新发送会复用消息编号。`} />}
      {read.error && <Alert type="warning" title="已读同步失败" description={read.error.message}
        action={<Button size="small" loading={read.isPending} onClick={() => markRead(latestSequence)}>重试</Button>} />}
      <Input.TextArea aria-label="消息内容" placeholder="输入消息；Enter 发送，Shift+Enter 换行"
        autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} showCount value={draft}
        disabled={send.isPending || query.isError || query.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onPressEnter={(event) => {
          if (!event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() }
        }} />
      <div className="human-chat__send"><Text type="secondary">消息保存于数据库，刷新或重登可恢复</Text>
        <Button type="primary" icon={<SendOutlined />} loading={send.isPending}
          disabled={!draft.trim() || query.isError || query.isPending} onClick={submit}>发送</Button></div>
    </div>
  </section>
}

export default function ChatPage() {
  const { session } = useAuth()
  const navigation = getRoleNavigation(session?.role ?? 'admin')
  const [search, setSearch] = useState('')
  const [settledSearch, setSettledSearch] = useState('')
  const [target, setTarget] = useState<ChatTarget | null>(null)
  const contacts = useChatContacts(settledSearch)
  const conversations = useChatConversations()
  useEffect(() => { const timer = setTimeout(() => setSettledSearch(search.trim()), 300)
    return () => clearTimeout(timer) }, [search])
  const title = session?.role === 'buyer' ? '平台客服' : '人工沟通'

  return <Layout className="human-chat">
    <Header className="human-chat__header"><Space><MessageOutlined /><Title level={4} style={{ margin: 0 }}>{title}</Title></Space>
      <Space wrap><Link to="/messages">业务通知</Link><Link to={navigation.homePath}><ArrowLeftOutlined /> 返回{navigation.homeLabel}</Link></Space>
    </Header>
    <Content className="human-chat__content">
      {authMode === 'demo' ? <Alert type="warning" showIcon title="人工聊天需要真实 API 登录"
        description="当前是静态演示模式，不提供虚构联系人或聊天记录；切换 API 模式后登录真实账号即可使用。" /> : <>
        <Text type="secondary" className="human-chat__scope">{session?.role === 'buyer'
          ? '仅联系平台客服，不开放内部协作通讯录。' : '联系人按当前组织、已分配批次协作关系与平台管理权限确定。'}</Text>
        <div className={`human-chat__workspace ${target ? 'human-chat__workspace--selected' : ''}`}>
          <aside className="human-chat__sidebar">
            <Title level={5}>会话</Title>
            {conversations.error && <Alert type="error" title={conversations.error.message}
              action={<Button size="small" onClick={() => { void conversations.refetch() }}>重试</Button>} />}
            {conversations.isPending ? <Spin /> : !conversations.error && <>
              {!conversations.data?.items.length && <Text type="secondary">暂无会话，从下方选择联系人</Text>}
              {conversations.data?.items.map((item) => <button key={item.id} type="button"
                className={`human-chat__contact ${target?.id === item.id ? 'human-chat__contact--active' : ''}`}
                onClick={() => setTarget({ id: item.id, contact: item.contact })}>
                <Badge count={item.unreadCount} size="small"><strong>{item.contact.displayName}</strong></Badge>
                <span>{item.contact.username} · {chatRoleLabels[item.contact.role]}</span>
                <span className="human-chat__preview">{item.lastMessage?.content ?? '尚未发送消息'}</span>
              </button>)}
              {conversations.data?.hasMore && <Text type="secondary">仅列最近 100 个会话，更早会话可搜索联系人打开</Text>}
            </>}
            <Title level={5}>找联系人</Title>
            <Input aria-label="搜索联系人" placeholder="姓名 / 登录账号 / 组织" allowClear maxLength={80}
              value={search} onChange={(event) => setSearch(event.target.value)} />
            {contacts.query.error && <Alert type="error" title={contacts.query.error.message}
              action={<Button size="small" onClick={() => { void contacts.query.refetch() }}>重试</Button>} />}
            {contacts.open.error && <Alert type="error" title={contacts.open.error.message} />}
            {contacts.query.isPending ? <Spin /> : !contacts.query.error && <>
              {!contacts.query.data?.items.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到可联系的账号" />}
              {contacts.query.data?.items.map((contact) => <button type="button" className="human-chat__contact" key={contact.id}
                disabled={contacts.open.isPending || search.trim() !== settledSearch}
                onClick={() => contacts.open.mutate(contact.id, { onSuccess: setTarget })}>
                <strong>{contact.displayName}</strong><span>{contact.username} · {chatRoleLabels[contact.role]}</span>
                <span>{contact.organizationName ?? '平台'}</span>
              </button>)}
              {contacts.query.data?.hasMore && <Text type="secondary">结果超过 30 个，请缩小搜索范围</Text>}
            </>}
          </aside>
          <main className="human-chat__main">
            {target ? <><Button className="human-chat__back" icon={<ArrowLeftOutlined />} onClick={() => setTarget(null)}>返回会话与联系人</Button>
              <ChatPanel key={`${session?.userId}:${target.id}`} target={target} /></>
              : <Empty description="选择联系人或已有会话开始沟通" />}
          </main>
        </div>
      </>}
    </Content>
  </Layout>
}
