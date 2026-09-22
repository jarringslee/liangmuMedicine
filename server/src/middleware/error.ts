import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

/** 统一错误格式；不要把数据库错误、堆栈或请求中的密码返回给前端。 */
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) return next(error)
  if (error instanceof ZodError) {
    res.status(400).json({ error: {
      code: 'VALIDATION_ERROR', message: '请求参数不正确',
      details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    } })
    return
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: '请求体不是有效 JSON' } })
      return
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' } })
      return
    }
  }
  console.error('Unexpected API error', error)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后重试' } })
}
