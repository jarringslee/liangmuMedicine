import { ApiError } from './api'
import type { AssistantReply } from '../types/assistant'

/** 普通聊天没有批次/来源；网络数据先按 unknown 验证再构建白名单对象。 */
export function parseGeneralAssistantReply(value: unknown, question: string, mode: 'api' | 'demo'): AssistantReply {
  const text = (item: unknown, max: number): item is string =>
    typeof item === 'string' && item.trim().length > 0 && item.length <= max
  const fail = () => { throw new ApiError(0, 'INVALID_RESPONSE', 'AI 助手返回格式不正确') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const item = value as Partial<AssistantReply>
  if (!text(item.id, 150) || item.scope !== 'general' || item.batchId !== null
    || item.question !== question || !text(item.answer, 3_000)
    || item.status !== 'answered' && item.status !== 'insufficient' || item.mode !== mode
    || item.modelName !== null && !text(item.modelName, 150)
    || mode === 'demo' && item.modelName !== null
    || mode === 'api' && item.status === 'answered' && item.modelName === null
    || !Array.isArray(item.citations) || item.citations.length !== 0
    || !text(item.createdAt, 100) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(item.createdAt)
    || !Number.isFinite(Date.parse(item.createdAt))) return fail()
  return { id: item.id, scope: 'general', batchId: null, question,
    status: item.status, answer: item.answer, citations: [], mode,
    modelName: item.modelName!, createdAt: item.createdAt }
}
