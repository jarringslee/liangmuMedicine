import { AUDIT_LABEL, RISK_LABEL, STAGE_LABEL, type HerbBatch } from '../types/herb'
import type { HerbQuestionReply } from '../types/herbQuestion'

/** 静态模式只展示档案摘录，不冒充模型生成或知识库检索。 */
export function answerDemoHerbQuestion(batch: HerbBatch, question: string): HerbQuestionReply {
  const pieces: string[] = []
  if (/产地|哪里|来自/.test(question)) {
    pieces.push(`本批次登记产地：${[batch.origin.province, batch.origin.city, batch.origin.district].filter(Boolean).join(' / ')}。`)
  }
  if (/阶段|状态|风险|审核|进度|目前/.test(question)) {
    pieces.push(`当前阶段：${STAGE_LABEL[batch.stage]}；审核状态：${AUDIT_LABEL[batch.auditStatus]}；风险等级：${RISK_LABEL[batch.riskLevel]}。`)
  }
  if (/名称|叫什么|哪味|什么药材/.test(question)) pieces.push(`本批次药材名称：${batch.herbName}。`)
  // 通用药材知识不能用某个演示批次的产地/状态来替代。
  if (/一般|通常|常见|植物|来源|类别|外观|主产|药用|识别|介绍/.test(question)) pieces.length = 0
  if (/剂量|用量|服用|治疗|治病|处方|孕妇|怀孕|怎么吃|能吃|能喝/.test(question)) pieces.length = 0
  const answered = pieces.length > 0
  const excerpt = pieces.join('\n')
  return {
    id: crypto.randomUUID(), batchId: batch.id, question,
    status: answered ? 'answered' : 'insufficient',
    answer: answered ? `本地档案演示（未调用 AI）：\n${excerpt}\n[batch:demo]`
      : '静态演示没有调用 AI 或知识库。可询问本批次名称、登记产地或当前状态；药材知识问答需要启动 API 模式。',
    citations: answered ? [{
      id: 'batch:demo', kind: 'batch', title: '当前批次本地档案', excerpt,
      publisher: '静态演示数据', url: null,
    }] : [],
    mode: 'demo', modelName: null, retrieval: 'demo', knowledgeVersion: 'demo-batch-only',
    createdAt: new Date().toISOString(),
  }
}
