import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRoles } from '../middleware/auth.js'
import type { AuthService } from '../services/auth.js'
import type { NotificationService } from '../services/notifications.js'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['all', 'unread', 'read']).default('all'),
}).strict()
const idSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)

export function createNotificationRouter(auth: AuthService, notifications: NotificationService) {
  const router = Router()
  // 用户私有通知不能被浏览器/代理作为公共响应缓存。
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.use(authenticate(auth), requireRoles('admin'))
  router.get('/', async (req, res) => {
    res.json(await notifications.list(req.auth!, querySchema.parse(req.query)))
  })
  router.patch('/:id/read', async (req, res) => {
    z.object({}).strict().parse(req.body ?? {})
    const item = await notifications.markRead(req.auth!, idSchema.parse(req.params.id))
    res.json({ item })
  })
  return router
}
