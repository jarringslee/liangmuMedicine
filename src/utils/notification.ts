import type { BusinessNotification } from '../types/notification'

export const notificationTypeLabels: Record<BusinessNotification['type'], string> = {
  batchSubmitted: '批次提交', auditResult: '审核结果', stageChanged: '阶段变化',
  qcReportUploaded: '质检报告', system: '系统消息',
}

const formatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
export const formatNotificationTime = (value: string) => formatter.format(new Date(value))
