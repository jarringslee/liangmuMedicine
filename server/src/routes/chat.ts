import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import type { AuthService } from '../services/auth.js'
import type { ChatService } from '../services/chat.js'

const idSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)
const sendSchema = z.object({ clientMessageId: z.uuid(), content: z.string().trim().min(1).max(2000) }).strict()

export function createChatRouter(auth: AuthService, chat: ChatService) {
  const router = Router()
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.use(authenticate(auth))
  const sendLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8',
    legacyHeaders: false, keyGenerator: (req) => req.auth!.id,
    handler: (_req, _res, next) => next(new HttpError(429, 'CHAT_RATE_LIMITED', '发送过于频繁，请稍后重试')) })
  router.get('/contacts', async (req, res) => {
    const { search } = z.object({ search: z.string().trim().max(80).default('') }).strict().parse(req.query)
    res.json(await chat.contacts(req.auth!, search))
  })
  router.get('/conversations', async (req, res) => {
    z.object({}).strict().parse(req.query)
    res.json(await chat.conversations(req.auth!))
  })
  router.post('/conversations', sendLimiter, async (req, res) => {
    const { recipientId } = z.object({ recipientId: idSchema }).strict().parse(req.body)
    res.json(await chat.open(req.auth!, recipientId))
  })
  router.get('/conversations/:id/messages', async (req, res) => {
    const { before } = z.object({ before: z.coerce.number().int().positive().max(2_147_483_647).optional() }).strict().parse(req.query)
    res.json(await chat.history(req.auth!, idSchema.parse(req.params.id), before))
  })
  router.post('/conversations/:id/messages', sendLimiter, async (req, res) => {
    res.json(await chat.send(req.auth!, idSchema.parse(req.params.id), sendSchema.parse(req.body)))
  })
  router.patch('/conversations/:id/read', async (req, res) => {
    const { sequence } = z.object({ sequence: z.number().int().nonnegative().max(2_147_483_647) }).strict().parse(req.body)
    res.json(await chat.markRead(req.auth!, idSchema.parse(req.params.id), sequence))
  })
  return router
}
