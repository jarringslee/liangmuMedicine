import { Router } from 'express'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'liangmuMedicine API',
    database: 'not-connected-yet',
    timestamp: new Date().toISOString(),
  })
})
