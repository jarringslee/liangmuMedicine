import { Tag } from 'antd'
import {
  AUDIT_LABEL,
  RISK_LABEL,
  STAGE_LABEL,
  type AuditStatus,
  type RiskLevel,
  type Stage,
} from '../../types/herb'

const STAGE_COLOR: Record<Stage, string> = {
  planting: 'green',
  harvested: 'lime',
  processing: 'gold',
  warehousing: 'blue',
  shipped: 'geekblue',
  sold: 'purple',
}

const AUDIT_COLOR: Record<AuditStatus, string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
}

const RISK_COLOR: Record<RiskLevel, string> = {
  normal: 'default',
  low: 'blue',
  medium: 'orange',
  high: 'red',
}

export function StageTag({ stage }: { stage: Stage }) {
  return <Tag color={STAGE_COLOR[stage]}>{STAGE_LABEL[stage]}</Tag>
}

export function AuditTag({ status }: { status: AuditStatus }) {
  return <Tag color={AUDIT_COLOR[status]}>{AUDIT_LABEL[status]}</Tag>
}

export function RiskTag({ level }: { level: RiskLevel }) {
  return <Tag color={RISK_COLOR[level]}>{RISK_LABEL[level]}</Tag>
}
