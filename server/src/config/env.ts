import dotenv from 'dotenv'
import { isIP } from 'node:net'
import { z } from 'zod'

dotenv.config()

// 不支持 true 或“信任 N 跳”：部署拓扑不同会让客户端伪造来源 IP。
const trustedProxySchema = z.string().trim().default('off').transform((input, context) => {
  if (input === 'off') return false as const
  const entries = input.split(',').map((entry) => entry.trim())
  const valid = entries.every((entry) => {
    if (entry === 'loopback') return true
    const parts = entry.split('/')
    const family = isIP(parts[0] ?? '')
    if (!family || parts.length > 2) return false
    if (parts.length === 1) return true
    const prefix = parts[1]!
    return /^\d+$/.test(prefix) && Number(prefix) > 0 && Number(prefix) <= (family === 4 ? 32 : 128)
  })
  if (!valid) {
    context.addIssue({ code: 'custom', message: 'TRUST_PROXY must be off, loopback, or known proxy IP/CIDR entries (not /0)' })
    return z.NEVER
  }
  return entries
})

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().trim().url().default('http://localhost:5173').superRefine((input, context) => {
    let url: URL
    try { url = new URL(input) } catch { return } // url() 已记录格式错误；不要让 safeParse 抛异常。
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
      context.addIssue({ code: 'custom', message: 'CLIENT_ORIGIN must be a single HTTP(S) origin without credentials, path, query or fragment' })
    }
  }).transform((input) => new URL(input).origin),
  TRUST_PROXY: trustedProxySchema,
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').refine((input) => {
    try {
      const url = new URL(input)
      return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1
    } catch { return false }
  }, 'DATABASE_URL must be a PostgreSQL connection URL with a host and database name'),
  // 单实例演示先限制连接数；连接池等待必须有上限，不能因云库断连一直挂起。
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(2),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  DEEPSEEK_API_KEY: z.string().trim().optional(),
  DEEPSEEK_MODEL: z.string().trim().min(1).default('deepseek-flash'),
  JWT_SECRET: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().min(32, 'JWT_SECRET must contain at least 32 characters').optional(),
  ),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.CLIENT_ORIGIN.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['CLIENT_ORIGIN'], message: 'Production requires an explicit HTTPS CLIENT_ORIGIN' })
  }
  if (value.NODE_ENV === 'production' && !value.JWT_SECRET) {
    context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET is required in production' })
  }
})

export const env = envSchema.parse(process.env)
