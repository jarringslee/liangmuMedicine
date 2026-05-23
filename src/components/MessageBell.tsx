import { Badge, Button, Divider, Popover, Tag, Typography } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { InboxMessage } from '../mock/message/inbox'
import { getRecentInboxPreview, getUnreadMessageCount } from '../mock/message/inbox'
import './MessageBell.less'

const { Text } = Typography

function SenderLine({ item }: { item: InboxMessage }) {
  if (item.channel === 'chat') {
    return (
      <span className="message-bell-item__sender">
        <Text strong ellipsis>
          {item.senderName}
        </Text>
        {item.senderRole ? <Tag>{item.senderRole}</Tag> : null}
      </span>
    )
  }
  return (
    <span className="message-bell-item__sender">
      <Text strong>{item.senderName}</Text>
    </span>
  )
}

export function MessageBell() {
  const navigate = useNavigate()
  const unread = getUnreadMessageCount()
  const recent = getRecentInboxPreview(5)

  const content = (
    <div className="message-bell-popover">
      <div className="message-bell-popover__list">
        {recent.map((item, index) => (
          <div key={item.id}>
            {index > 0 ? <Divider style={{ margin: '8px 0' }} /> : null}
            <div
              className={`message-bell-item ${!item.read ? 'message-bell-item--unread' : ''}`}
              role="presentation"
            >
              <div className="message-bell-item__row">
                <SenderLine item={item} />
                <Text type="secondary" className="message-bell-item__date">
                  {item.dateLabel}
                </Text>
              </div>
              <p className="message-bell-item__preview" title={item.preview}>
                {item.preview}
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
      <Badge count={unread} overflowCount={99} size="small">
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
