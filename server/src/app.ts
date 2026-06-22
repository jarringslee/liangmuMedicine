import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { healthRouter } from './routes/health.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))

  app.use('/api', healthRouter)

  app.use((_req, res) => {
    res.status(404).json({ message: 'API route not found' })
  })

  return app
}
