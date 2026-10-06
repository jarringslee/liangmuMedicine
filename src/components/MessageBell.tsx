import { Badge, Button, Divider, Popover, Typography } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { formatNotificationTime } from '../utils/notification'
import './MessageBell.less'

const { Text } = Typography

export function MessageBell() {
  const navigate = useNavigate()
  // 复用通知查询；实时连接只由 App 中的桥接 Hook 创建。
  const { query } = useNotifications({ page: 1, pageSize: 5, status: 'all' })

  const content = (
    <div className="message-bell-popover">
      <div className="message-bell-popover__list">
        {query.error && <Text type="danger">通知暂不可用，可进入消息中心重试</Text>}
        {query.isPending && <Text type="secondary">加载通知中…</Text>}
        {!query.isPending && !query.error && !query.data?.items.length && <Text type="secondary">暂无消息</Text>}
        {query.data?.items.map((item, index) => (
          <div key={item.id}>
            {index > 0 ? <Divider style={{ margin: '8px 0' }} /> : null}
            <div
              className={`message-bell-item ${!item.readAt ? 'message-bell-item--unread' : ''}`}
              role="presentation"
            >
              <div className="message-bell-item__row">
                <span className="message-bell-item__sender"><Text strong>{item.title}</Text></span>
                <Text type="secondary" className="message-bell-item__date">
                  {formatNotificationTime(item.createdAt)}
                </Text>
              </div>
              <p className="message-bell-item__preview" title={item.content}>
                {item.content}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="message-bell-popover__footer">
        <Divider style={{ margin: '8px 0' }} />
        <Button type="link" block onClick={() => navigate('/messages')}>
          查看全部消息
        </Button>
      </div>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="hover"
      placement="bottomRight"
      mouseEnterDelay={0.15}
    >
      <Badge count={query.data?.unreadCount ?? 0} overflowCount={99} size="small">
        <Button
          type="text"
          icon={<BellOutlined />}
          aria-label="消息中心"
          onClick={() => navigate('/messages')}
        />
      </Badge>
    </Popover>
  )
}
