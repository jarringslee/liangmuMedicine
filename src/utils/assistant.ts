import type { AssistantBatch, AssistantReply, AssistantTurn } from '../types/assistant'

export const assistantBatchPrefix = (batch: AssistantBatch) => `对于${batch.herbName}批次 ${batch.batchNo}，`

/** [batch:origin] → [1]；只转换已验证来源，不展示内部 ID。 */
export function formatAssistantAnswer(reply: AssistantReply): string {
  const numbers = new Map(reply.citations.map((item, index) => [item.id, index + 1]))
  return reply.answer.replace(/\[([^\]\n]+)\]/g, (original, id: string) =>
    numbers.has(id) ? `[${numbers.get(id)}]` : original)
}

/** 服务端终态优先；本地停止/错误可覆盖尚未落库的 pending，不复制服务器状态。 */
export function mergeAssistantTurns(server: AssistantTurn[], local: AssistantTurn[]): AssistantTurn[] {
  const turns = new Map(server.map((turn) => [turn.id, turn]))
  for (const turn of local) {
    const saved = turns.get(turn.id)
    if (!saved || saved.status === 'pending') turns.set(turn.id, turn)
  }
  return [...turns.values()].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')).slice(-40)
}
