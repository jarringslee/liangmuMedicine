import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRoles } from '../middleware/auth.js'
import type { AuthService } from '../services/auth.js'
import type { DashboardService } from '../services/dashboard.js'

export function createDashboardRouter(auth: AuthService, dashboard: DashboardService) {
  const router = Router()
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  router.use(authenticate(auth), requireRoles('admin'))
  router.get('/overview', async (req, res) => {
    z.object({}).strict().parse(req.query)
    res.json(await dashboard.overview(req.auth!))
  })
  return router
}
