import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { healthRouter } from './routes/health.js'
import { createAuthRouter } from './routes/auth.js'
import { createAuthService, type AuthService } from './services/auth.js'
import { errorHandler, HttpError } from './middleware/error.js'

export function createApp(authService: AuthService = createAuthService()) {
  const app = express()

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '2mb' }))

  app.use('/api', healthRouter)
  app.use('/api/auth', createAuthRouter(authService))

  app.use((_req, _res, next) => {
    next(new HttpError(404, 'NOT_FOUND', 'API route not found'))
  })
  app.use(errorHandler)

  return app
}
