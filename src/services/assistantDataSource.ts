import { authMode } from '../config/api'
import type { AssistantHistory, AssistantReply, AssistantRequest, AssistantTurn } from '../types/assistant'
import { apiRequest } from './api'
import { askHerbQuestion } from './herbDataSource'
import { parseGeneralAssistantReply } from './assistantContract'
import { parseAssistantHistory, parseAssistantTurn } from './assistantHistoryContract'

/** 第十五刀单轮兼容接口；第十六刀 Hook 改用下方会话接口，不再由前端分流。 */
export async function askAssistant(input: AssistantRequest, signal: AbortSignal): Promise<AssistantReply> {
  signal.throwIfAborted()
  const question = input.question.trim()
  if (question.length < 2 || question.length > 500) throw new Error('问题需要 2～500 个字符')
  if (input.batch) {
    const reply = await askHerbQuestion(input.batch.id, question, signal)
    if (reply.question !== question) throw new Error('问答回复与当前问题不匹配')
    return { id: reply.id, scope: 'batch', batchId: reply.batchId, question,
      answer: reply.answer, status: reply.status, citations: reply.citations,
      mode: reply.mode, modelName: reply.modelName, createdAt: reply.createdAt }
  }
  if (authMode === 'demo') {
    return parseGeneralAssistantReply({
      id: crypto.randomUUID(), scope: 'general', batchId: null, question,
      status: 'insufficient', mode: 'demo', modelName: null, citations: [],
      answer: '当前为静态演示，未调用 AI。可从药材详情带入批次查看本地档案；普通模型聊天需要启动 API 模式。',
      createdAt: new Date().toISOString(),
    }, question, 'demo')
  }
  const response = await apiRequest<{ reply: unknown }>('/assistant/chat', {
    method: 'POST', body: { question }, signal, timeoutMs: 70_000,
  })
  return parseGeneralAssistantReply(response.reply, question, 'api')
}

export async function getAssistantHistory(signal: AbortSignal): Promise<AssistantHistory> {
  signal.throwIfAborted()
  if (authMode === 'demo') return { conversationId: null, mode: 'demo', turns: [] }
  return parseAssistantHistory(await apiRequest<unknown>('/assistant/conversation', { signal }))
}

export async function sendAssistantMessage(id: string, input: AssistantRequest, signal: AbortSignal): Promise<AssistantTurn> {
  signal.throwIfAborted()
  const question = input.question.trim()
  if (question.length < 2 || question.length > 500) throw new Error('问题需要 2～500 个字符')
  if (authMode === 'demo') {
    const reply = await askAssistant({ ...input, question }, signal)
    return { id, question, batch: input.batch ? { ...input.batch } : null, status: 'done', reply, createdAt: reply.createdAt }
  }
  const response = await apiRequest<{ turn: unknown }>('/assistant/conversation/messages', {
    method: 'POST', body: { requestId: id, question, batchIdentifier: input.batch?.id ?? null },
    signal, timeoutMs: 70_000,
  })
  return parseAssistantTurn(response.turn, { id, question })
}
