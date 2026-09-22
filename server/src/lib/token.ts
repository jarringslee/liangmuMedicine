import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify, errors } from 'jose'
import { env } from '../config/env.js'
import { HttpError } from '../middleware/error.js'

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
const issuer = 'liangmuMedicine'
const audience = 'liangmuMedicine-web'
// 不使用写死的默认密钥。开发临时密钥仅在当前进程有效，生产缺少密钥会被 env 校验拦截。
const secret = new TextEncoder().encode(env.JWT_SECRET ?? randomBytes(32).toString('hex'))
if (!env.JWT_SECRET && env.NODE_ENV !== 'test') {
  console.warn('JWT_SECRET 未配置：本次使用随机开发密钥，重启服务后需要重新登录。')
}

export function signAccessToken(userId: string) {
  // Token 只标识身份；角色、组织和禁用状态在请求时从数据库重新读取。
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'], issuer, audience, typ: 'JWT',
      requiredClaims: ['sub', 'iat', 'exp'],
    })
    if (!payload.sub) throw new HttpError(401, 'INVALID_TOKEN', '登录凭证无效，请重新登录')
    return payload.sub
  } catch (error) {
    if (error instanceof errors.JOSEError) {
      throw new HttpError(401, 'INVALID_TOKEN', '登录凭证无效或已过期，请重新登录')
    }
    throw error
  }
}
