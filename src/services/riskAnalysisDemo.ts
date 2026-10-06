import type { HerbBatch } from '../types/herb'
import type { RiskAnalysis, RiskReviewInput } from '../types/riskAnalysis'
import { addBatchEvent, getById, setAuditStatus, updateBatch } from './herbStorage'

type DemoRecord = { analysis: RiskAnalysis; signature: string }
const storageKey = (batchId: string) => `liangmu_risk_analysis_demo:${batchId}`

// 本地分析记录与事件的新增会修改 updatedAt；比较业务字段/公开事件才能判断依据是否过期。
function signature(batch: HerbBatch) {
  return JSON.stringify({
    herbName: batch.herbName,
    category: batch.category,
    plantingStartDate: batch.plantingStartDate,
    origin: batch.origin,
    environment: batch.environment,
    stage: batch.stage,
    auditStatus: batch.auditStatus,
    riskLevel: batch.riskLevel,
    events: batch.events.filter((event) => !event.scopes?.includes('admin')),
  })
}

async function requireBatch(batchId: string) {
  const batch = await getById(batchId)
  if (!batch) throw new Error('药材批次不存在')
  return batch
}

export async function getDemoRiskAnalysis(batchId: string): Promise<RiskAnalysis | null> {
  const batch = await requireBatch(batchId)
  const raw = localStorage.getItem(storageKey(batchId))
  if (!raw) return null
  let record: DemoRecord
  try { record = JSON.parse(raw) as DemoRecord } catch { return null }
  if (!record.analysis || record.analysis.batchId !== batchId
    || !Array.isArray(record.analysis.evidence) || !Array.isArray(record.analysis.toolCalls)) return null
  return {
    ...record.analysis,
    stale: record.signature !== signature(batch) || batch.auditStatus !== 'pending',
  }
}

/** 静态站点明确展示本地规则结果，不把它描述为已调用 DeepSeek。 */
export async function analyzeDemoRisk(batchId: string): Promise<RiskAnalysis> {
  const batch = await requireBatch(batchId)
  if (batch.auditStatus !== 'pending') throw new Error('仅待审核批次可以发起分析')
  const missingInformation: string[] = []
  if (!batch.origin.province || !batch.origin.city) missingInformation.push('缺少完整的省市产地信息')
  if (!batch.environment?.trim()) missingInformation.push('缺少种植环境说明')
  if (!batch.events.some((event) => event.type === 'create')) missingInformation.push('缺少建档事件')
  if (['warehousing', 'shipped', 'sold'].includes(batch.stage)
    && !batch.events.some((event) => event.type === 'qcReport')) missingInformation.push('加工入库后缺少质检文字记录')
  const createdAt = new Date().toISOString()
  const riskLevel = batch.riskLevel !== 'normal' ? batch.riskLevel
    : missingInformation.length ? 'low' : 'normal'
  const analysis: RiskAnalysis = {
    id: crypto.randomUUID(),
    batchId,
    basedOnVersion: 1,
    reviewVersion: 2,
    modelName: 'local-rules-demo',
    promptVersion: 'audit-risk-v1',
    createdAt,
    mode: 'demo',
    riskLevel,
    recommendation: riskLevel === 'normal' ? 'approve' : 'manualReview',
    summary: missingInformation.length
      ? '本地规则演示：部分资料缺失，请人工补充或复核。'
      : '本地规则演示：本轮资料完整性检查未发现缺失，可由管理员继续审核。',
    missingInformation,
    evidence: [
      { sourceId: 'batch:identity', note: `${batch.herbName}，批次 ${batch.batchNo}` },
      { sourceId: 'batch:environment', note: batch.environment || '未提供种植环境说明' },
    ],
    toolCalls: [
      { name: 'get_batch_snapshot', summary: '本地读取批次快照', completedAt: createdAt },
      { name: 'inspect_trace_records', summary: '本地检查资料完整性', completedAt: createdAt },
    ],
    stale: false,
  }
  await addBatchEvent(batchId, {
    type: 'note',
    title: '风险分析建议（本地规则演示）',
    description: analysis.summary,
    occurredAt: createdAt,
    operatorName: '本地演示助手',
    operatorRole: 'admin',
    scopes: ['admin'],
  })
  // 存储失败向用户报错，不把未持久化的结果当作可审核依据。
  localStorage.setItem(storageKey(batchId), JSON.stringify({ analysis, signature: signature(batch) }))
  return analysis
}

export async function reviewDemoRisk(batchId: string, analysisId: string, input: RiskReviewInput) {
  const analysis = await getDemoRiskAnalysis(batchId)
  if (!analysis || analysis.id !== analysisId || analysis.stale) throw new Error('批次或分析已变化，请重新分析')
  await setAuditStatus(batchId, input.decision)
  await updateBatch(batchId, { riskLevel: input.riskLevel })
  await addBatchEvent(batchId, {
    type: 'audit',
    title: '人工复核（本地规则辅助）',
    description: `${input.reason}\n关联分析：${analysisId}`,
    occurredAt: new Date().toISOString(),
    operatorName: '管理员（本地演示）',
    operatorRole: 'admin',
    scopes: ['admin'],
  })
  return { batchId, decision: input.decision }
}
