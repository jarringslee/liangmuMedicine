import { useMemo } from 'react'
import { Empty, Tag, Timeline, Typography } from 'antd'
import type { TimelineProps } from 'antd'
import {
  AuditOutlined,
  CarOutlined,
  DropboxOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  PlusCircleOutlined,
  SwapOutlined,
  TransactionOutlined,
} from '@ant-design/icons'
import {
  EVENT_TYPE_LABEL,
  STAGE_LABEL,
  type BatchEvent,
  type EventType,
} from '../../types/herb'
import type { UserRole } from '../../types/auth'
import { filterEventsForRole } from '../../utils/herbEvents'
import './TraceTimeline.less'

const { Text } = Typography

const EVENT_ICON: Record<EventType, React.ReactNode> = {
  create: <PlusCircleOutlined />,
  audit: <AuditOutlined />,
  stageChange: <SwapOutlined />,
  qcReport: <ExperimentOutlined />,
  storage: <DropboxOutlined />,
  transport: <CarOutlined />,
  transaction: <TransactionOutlined />,
  note: <FileTextOutlined />,
}

const EVENT_COLOR: Record<EventType, string> = {
  create: 'green',
  audit: 'blue',
  stageChange: 'purple',
  qcReport: 'cyan',
  storage: 'gold',
  transport: 'geekblue',
  transaction: 'magenta',
  note: 'gray',
}

const OPERATOR_ROLE_LABEL: Record<NonNullable<BatchEvent['operatorRole']>, string> = {
  admin: '管理员',
  grower: '种植商',
  processor: '加工商',
  buyer: '采购商',
  system: '系统',
}

type Props = {
  events: BatchEvent[]
  role: UserRole
  /** 是否按时间倒序展示（默认 true，最新在上） */
  reverse?: boolean
  /** 仅取前 N 条（在倒序后截取） */
  limit?: number
  mode?: TimelineProps['mode']
  /** 空数据时的描述文案 */
  emptyDescription?: string
}

export default function TraceTimeline({
  events,
  role,
  reverse = true,
  limit,
  mode = 'left',
  emptyDescription = '暂无链路事件',
}: Props) {
  const visible = useMemo(() => {
    const filtered = filterEventsForRole(events, role)
    const sorted = [...filtered].sort((a, b) =>
      reverse ? (a.occurredAt < b.occurredAt ? 1 : -1) : a.occurredAt < b.occurredAt ? -1 : 1,
    )
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted
  }, [events, role, reverse, limit])

  if (visible.length === 0) {
    return <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
  }

  return (
    <Timeline
      mode={mode}
      items={visible.map((e) => ({
        color: EVENT_COLOR[e.type],
        dot: EVENT_ICON[e.type] as React.ReactNode,
        children: <EventCard event={e} />,
      }))}
    />
  )
}

function EventCard({ event }: { event: BatchEvent }) {
  return (
    <div>
      <div className="trace-timeline__event-title">
        <Tag bordered={false}>{EVENT_TYPE_LABEL[event.type]}</Tag>
        <span>{event.title}</span>
        {event.fromStage && event.toStage ? (
          <Tag color="purple" bordered={false}>
            {STAGE_LABEL[event.fromStage]} → {STAGE_LABEL[event.toStage]}
          </Tag>
        ) : null}
        <span className="trace-timeline__event-time">{event.occurredAt}</span>
      </div>
      {event.description ? (
        <div className="trace-timeline__event-desc">{event.description}</div>
      ) : null}
      {event.operatorName ? (
        <div className="trace-timeline__event-desc">
          <Text type="secondary" style={{ fontSize: 12 }}>
            操作主体：{event.operatorName}
            {event.operatorRole ? `（${OPERATOR_ROLE_LABEL[event.operatorRole]}）` : ''}
          </Text>
        </div>
      ) : null}
      {event.attachments && event.attachments.length > 0 ? (
        <div className="trace-timeline__event-attachments">
          {event.attachments.map((a) => (
            <Tag key={a.url + a.name} icon={<PaperClipOutlined />}>
              <a href={a.url} target="_blank" rel="noreferrer">
                {a.name}
              </a>
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  )
}
