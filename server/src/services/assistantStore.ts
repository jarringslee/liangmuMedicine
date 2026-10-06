import { Prisma, type AssistantTurn } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/error.js'
import type { AuthUser } from './auth.js'

export type StoredAssistantTurn = AssistantTurn
export type BeginTurn = {
  requestId: string; question: string; requestedIdentifier: string | null
  batch: { id: string; herbName: string; batchNo: string; version: number } | null
}
export type FinishTurn = { status: 'done' | 'error' | 'stopped'; reply?: Prisma.InputJsonValue; errorCode?: string }
export interface AssistantStore {
  read(userId: string): Promise<{ conversationId: string | null; turns: StoredAssistantTurn[] }>
  find(userId: string, requestId: string): Promise<StoredAssistantTurn | null>
  begin(user: AuthUser, input: BeginTurn): Promise<{ turn: StoredAssistantTurn; claimed: boolean }>
  finish(userId: string, turn: StoredAssistantTurn, result: FinishTurn): Promise<StoredAssistantTurn | null>
}

export function createAssistantStore(db = prisma): AssistantStore {
  return {
    async read(userId) {
      const conversation = await db.assistantConversation.findUnique({
        where: { userId }, select: { id: true, turns: { orderBy: { sequence: 'desc' }, take: 40 } },
      })
      return { conversationId: conversation?.id ?? null, turns: conversation?.turns.reverse() ?? [] }
    },
    find: (userId, requestId) => db.assistantTurn.findFirst({ where: { requestId, conversation: { userId } } }),
    async begin(user, input) {
      return db.$transaction(async (tx) => {
        const conversation = await tx.assistantConversation.upsert({ where: { userId: user.id },
          create: { userId: user.id }, update: {}, select: { id: true, version: true } })
        const previous = await tx.assistantTurn.findUnique({ where: {
          conversationId_requestId: { conversationId: conversation.id, requestId: input.requestId },
        } })
        if (previous) return { turn: previous, claimed: false }
        const now = new Date()
        const claimed = await tx.assistantConversation.updateMany({ where: {
          id: conversation.id, version: conversation.version,
          OR: [{ runningUntil: null }, { runningUntil: { lte: now } }],
        }, data: { version: { increment: 1 }, runningRequestId: input.requestId,
          runningUntil: new Date(now.getTime() + 65_000) } })
        if (!claimed.count) throw new HttpError(409, 'AI_QUESTION_RUNNING', '已有回答正在进行，请稍后再试')
        // 上个进程中断/租约过期的 pending 不重跑，保留中断记录。
        await tx.assistantTurn.updateMany({ where: { conversationId: conversation.id, status: 'pending' },
          data: { status: 'stopped', errorCode: 'AI_INTERRUPTED' } })
        const turn = await tx.assistantTurn.create({ data: {
          conversationId: conversation.id, requestId: input.requestId, sequence: conversation.version + 1,
          question: input.question, requestedIdentifier: input.requestedIdentifier,
          actorRole: user.role, actorOrganizationId: user.organizationId,
          batchId: input.batch?.id ?? null, batchVersion: input.batch?.version ?? null,
          batchLabel: input.batch ? { id: input.batch.id, herbName: input.batch.herbName, batchNo: input.batch.batchNo } : Prisma.DbNull,
        } })
        return { turn, claimed: true }
      })
    },
    async finish(userId, turn, result) {
      return db.$transaction(async (tx) => {
        const released = await tx.assistantConversation.updateMany({ where: {
          id: turn.conversationId, userId, version: turn.sequence,
          runningRequestId: turn.requestId, runningUntil: { gt: new Date() },
        }, data: { runningRequestId: null, runningUntil: null } })
        if (!released.count) return null // 租约已被新请求接管，旧结果不能覆盖它。
        return tx.assistantTurn.update({ where: { id: turn.id }, data: {
          status: result.status, reply: result.reply ?? Prisma.DbNull, errorCode: result.errorCode ?? null,
        } })
      })
    },
  }
}
