import { Button, Card, Descriptions, Flex, Modal, Space, Tag, Typography } from 'antd'
import {
  EnvironmentOutlined,
  EyeOutlined,
  MedicineBoxOutlined,
  ShopOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { AuditTag, RiskTag, StageTag } from './herbTags'
import TraceTimeline from './TraceTimeline'
import { HERB_CATEGORY_LABEL, type HerbBatch } from '../../types/herb'
import type { UserRole } from '../../types/auth'
import './TraceQuickViewModal.less'

const { Title, Text, Paragraph } = Typography

type Props = {
  open: boolean
  batch: HerbBatch | null
  role: UserRole
  onClose: () => void
  /** 「查看完整档案」点击：默认 navigate(`/trace/<code>`, { state: { fromInternal: true } }) */
  onViewFull?: (batch: HerbBatch) => void
}

function formatOrigin(b: HerbBatch): string {
  return [b.origin.province, b.origin.city, b.origin.district, b.origin.address]
    .filter(Boolean)
    .join(' / ')
}

export default function TraceQuickViewModal({ open, batch, role, onClose, onViewFull }: Props) {
  const navigate = useNavigate()

  const handleViewFull = () => {
    if (!batch) return
    if (onViewFull) {
      onViewFull(batch)
      return
    }
    onClose()
    navigate(`/trace/${batch.traceCode}`, { state: { fromInternal: true } })
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space size={8}>
          <MedicineBoxOutlined />
          <span>溯源信息</span>
          {batch ? (
            <Text type="secondary" copyable={{ text: batch.traceCode }} style={{ fontSize: 13 }}>
              {batch.traceCode}
            </Text>
          ) : null}
        </Space>
      }
      width={760}
      footer={
        <Flex justify="space-between" align="center" wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>
            完整档案含基础信息、附件、二维码与分享
          </Text>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <Button type="primary" icon={<EyeOutlined />} onClick={handleViewFull} disabled={!batch}>
              查看完整档案
            </Button>
          </Space>
        </Flex>
      }
      destroyOnClose
    >
      {batch ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* 关键信息卡 */}
          <Card bordered={false} className="trace-quickview__hero">
            <Flex gap={16} align="flex-start" wrap>
              <div
                className="trace-quickview__cover"
                aria-label={batch.herbName}
                style={{
                  backgroundImage: `url(${batch.coverImageUrl ?? '/images/herbs/placeholder.svg'})`,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
                  {batch.herbName}
                  <Tag style={{ marginLeft: 8 }}>{HERB_CATEGORY_LABEL[batch.category]}</Tag>
                </Title>
                <Space size={4} wrap style={{ marginBottom: 12 }}>
                  <StageTag stage={batch.stage} />
                  <AuditTag status={batch.auditStatus} />
                  <RiskTag level={batch.riskLevel} />
                </Space>

                <Descriptions column={1} size="small" colon>
                  <Descriptions.Item
                    label={
                      <span>
                        <ShopOutlined /> 种植商
                      </span>
                    }
                  >
                    {batch.growerName}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <span>
                        <EnvironmentOutlined /> 产地
                      </span>
                    }
                  >
                    {formatOrigin(batch)}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label={
                      <span>
                        <TagsOutlined /> 批次号
                      </span>
                    }
                  >
                    <Text copyable={{ text: batch.batchNo }}>{batch.batchNo}</Text>
                  </Descriptions.Item>
                </Descriptions>

                {batch.description ? (
                  <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                    {batch.description}
                  </Paragraph>
                ) : null}
              </div>
            </Flex>
          </Card>

          {/* 溯源链路 */}
          <Card
            bordered={false}
            size="small"
            title={
              <Space>
                <span>溯源链路</span>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  按时间倒序，最新事件在上
                </Text>
              </Space>
            }
            className="trace-quickview__timeline-card"
          >
            <TraceTimeline events={batch.events} role={role} />
          </Card>
        </Space>
      ) : null}
    </Modal>
  )
}
