import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { HttpError } from '../middleware/error.js'
import { PUBLIC_TRACE_CODE_REGEX, type PublicTraceService } from '../services/publicTrace.js'

export function createPublicTraceRouter(service: PublicTraceService, limit = 60) {
  const router = Router()
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  // 匿名只读，不读取 JWT；默认以连接 IP 限流，不信任客户端传入的账号/组织。
  // 多实例及可信代理配置属于公网部署阶段，当前内存限流不能冒充全局限流。
  router.use(rateLimit({ windowMs: 60_000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new HttpError(429, 'PUBLIC_TRACE_RATE_LIMITED', '查询过于频繁，请稍后重试')) }))
  router.get('/:traceCode', async (req, res) => {
    z.object({}).strict().parse(req.query)
    const traceCode = z.string().trim().toUpperCase().max(80).regex(PUBLIC_TRACE_CODE_REGEX).parse(req.params.traceCode)
    res.json({ batch: await service.detail(traceCode) })
  })
  return router
}
