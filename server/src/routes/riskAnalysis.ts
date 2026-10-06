import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import type { AuthService } from '../services/auth.js'
import { reviewRiskSchema, type RiskAnalysisService } from '../services/riskAnalysis.js'

const identifierSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/)

export function createRiskAnalysisRouter(auth: AuthService, service: RiskAnalysisService) {
  const router = Router()
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  // 只保护 AI 子路径，避免把同一 /api/batches 下的其他角色接口拦住。
  router.use('/:identifier/risk-analysis', authenticate(auth), requireRoles('admin'))
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    keyGenerator: (req) => req.auth!.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'AI_RATE_LIMITED', 'AI 分析请求过于频繁，请稍后重试')),
  })
  router.get('/:identifier/risk-analysis', async (req, res) => {
    const identifier = identifierSchema.parse(req.params.identifier)
    res.json({ analysis: await service.latest(req.auth!, identifier) })
  })
  router.post('/:identifier/risk-analysis', limiter, async (req, res) => {
    const identifier = identifierSchema.parse(req.params.identifier)
    z.object({}).strict().parse(req.body ?? {})
    res.status(201).json({ analysis: await service.analyze(req.auth!, identifier) })
  })
  router.post('/:identifier/risk-analysis/stream', limiter, async (req, res, next) => {
    const identifier = identifierSchema.parse(req.params.identifier)
    z.object({}).strict().parse(req.body ?? {})
    const controller = new AbortController()
    // 不能用 req.close：请求体读完不等于浏览器关闭了响应流。
    const disconnected = () => {
      if (!res.writableEnded) controller.abort()
    }
    req.once('aborted', disconnected)
    res.once('close', disconnected)
    let heartbeat: ReturnType<typeof setInterval> | undefined
    const send = (event: string, data: unknown) => {
      if (controller.signal.aborted || res.destroyed) {
        controller.abort()
        throw new HttpError(499, 'AI_CANCELLED', '客户端已断开分析连接')
      }
      if (!res.headersSent) {
        res.status(200).set({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          'X-Accel-Buffering': 'no',
        })
        res.flushHeaders()
        heartbeat = setInterval(() => {
          if (!res.destroyed && !res.writableEnded) res.write(': keep-alive\n\n')
        }, 10_000)
        heartbeat.unref()
      }
      // 进度事件由有界循环产生，数据量有限；不把完整快照发送到进度帧。
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }
    try {
      const analysis = await service.analyze(req.auth!, identifier, {
        signal: controller.signal,
        onProgress: (progress) => send('progress', progress),
      })
      send('result', { analysis })
      res.end()
    } catch (error) {
      if (controller.signal.aborted || res.destroyed) return
      // 尚未开始 SSE 时仍使用标准 HTTP 错误；已开始后不能再改状态码。
      if (!res.headersSent) return next(error)
      const safeError = error instanceof HttpError
        ? error : new HttpError(500, 'INTERNAL_ERROR', '分析服务暂时不可用，请稍后重试')
      send('error', { status: safeError.status, code: safeError.code, message: safeError.message })
      res.end()
    } finally {
      if (heartbeat) clearInterval(heartbeat)
      req.off('aborted', disconnected)
      res.off('close', disconnected)
    }
  })
  router.post('/:identifier/risk-analysis/:analysisId/review', async (req, res) => {
    const identifier = identifierSchema.parse(req.params.identifier)
    const analysisId = identifierSchema.parse(req.params.analysisId)
    const input = reviewRiskSchema.parse(req.body)
    res.json(await service.review(req.auth!, identifier, analysisId, input))
  })
  return router
}
