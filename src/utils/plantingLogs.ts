/** 种植日志：从批次 events 中提取 grower 提交的 note 事件 */

import type { BatchEvent, HerbBatch } from '../types/herb'

export type PlantingLogRow = {
  eventId: string
  batchId: string
  herbName: string
  batchNo: string
  traceCode: string
  title: string
  description?: string
  occurredAt: string
  operatorName?: string
  attachmentCount: number
}

/** 种植商日常记录：note 类型 + grower 操作者 */
export function isPlantingLogEvent(event: BatchEvent): boolean {
  return event.type === 'note' && event.operatorRole === 'grower'
}

export function collectPlantingLogs(batches: HerbBatch[]): PlantingLogRow[] {
  return batches.flatMap((batch) =>
    batch.events.filter(isPlantingLogEvent).map((event) => ({
      eventId: event.id,
      batchId: batch.id,
      herbName: batch.herbName,
      batchNo: batch.batchNo,
      traceCode: batch.traceCode,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt,
      operatorName: event.operatorName,
      attachmentCount: event.attachments?.length ?? 0,
    })),
  )
}
