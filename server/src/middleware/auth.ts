import type { RequestHandler } from 'express'
import type { UserRole } from '@prisma/client'
import type { AuthService, AuthUser } from '../services/auth.js'
import { verifyAccessToken } from '../lib/token.js'
import { HttpError } from './error.js'

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthUser
  }
}

export function authenticate(service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer (\S+)$/i.exec(req.get('authorization') ?? '')
    if (!match) throw new HttpError(401, 'UNAUTHENTICATED', '请先登录')
    const userId = await verifyAccessToken(match[1])
    // 每次读取数据库状态，已签发 Token 的账号也能在禁用后立即失去访问权。
    req.auth = await service.currentUser(userId)
    next()
  }
}

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new HttpError(401, 'UNAUTHENTICATED', '请先登录'))
    if (!roles.includes(req.auth.role)) return next(new HttpError(403, 'FORBIDDEN', '没有执行此操作的权限'))
    next()
  }
}
