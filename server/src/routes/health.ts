import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

export const healthRouter = Router()

healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    res.json({
      status: 'ok',
      service: 'liangmuMedicine API',
      database: 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Database health check failed', error)
    res.status(503).json({
      status: 'degraded',
      service: 'liangmuMedicine API',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    })
  }
})
