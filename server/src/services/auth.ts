import { randomBytes } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import type { Prisma, UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/error.js'

const authSelect = {
  id: true, username: true, email: true, displayName: true,
  role: true, status: true, passwordHash: true, organizationId: true,
  organization: { select: { id: true, name: true, type: true, enabled: true } },
} satisfies Prisma.UserSelect

export type AuthRecord = Prisma.UserGetPayload<{ select: typeof authSelect }>
export type AuthUser = Omit<AuthRecord, 'passwordHash' | 'status' | 'organization'> & {
  organization: Omit<NonNullable<AuthRecord['organization']>, 'enabled'> | null
}

export interface AuthRepository {
  findByAccount(account: string): Promise<AuthRecord | null>
  findById(id: string): Promise<AuthRecord | null>
}

const repository: AuthRepository = {
  findByAccount: (account) => account.includes('@')
    ? prisma.user.findFirst({ where: { email: { equals: account, mode: 'insensitive' } }, select: authSelect })
    : prisma.user.findUnique({ where: { username: account }, select: authSelect }),
  findById: (id) => prisma.user.findUnique({ where: { id }, select: authSelect }),
}

// 不存在的账号也做一次 bcrypt 比较，减少通过响应耗时探测账号是否存在的机会。
const dummyPasswordHash = hash(randomBytes(32).toString('hex'), 12)

function toActiveUser(record: AuthRecord): AuthUser {
  if (record.status !== 'active') throw new HttpError(403, 'ACCOUNT_DISABLED', '账号已被禁用')
  const organization = record.organization
  if (organization && !organization.enabled) {
    throw new HttpError(403, 'ORGANIZATION_DISABLED', '所属组织已被停用')
  }
  const expectedType = record.role === 'admin' ? 'platform' : record.role
  if ((!organization && record.role !== 'admin') || (organization && organization.type !== expectedType)) {
    throw new HttpError(403, 'INVALID_ORGANIZATION', '账号的组织配置不正确')
  }
  return {
    id: record.id, username: record.username, email: record.email,
    displayName: record.displayName, role: record.role, organizationId: record.organizationId,
    organization: organization ? { id: organization.id, name: organization.name, type: organization.type } : null,
  }
}

/** 注入查询方法供自动化测试使用；正常启动时默认查询 PostgreSQL。 */
export function createAuthService(users: AuthRepository = repository) {
  return {
    async login(account: string, password: string, role: UserRole): Promise<AuthUser> {
      const record = await users.findByAccount(account)
      const passwordMatches = await compare(password, record?.passwordHash ?? await dummyPasswordHash)
      if (!record || !passwordMatches || record.role !== role) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', '账号、密码或所选角色不正确')
      }
      return toActiveUser(record)
    },
    async currentUser(id: string): Promise<AuthUser> {
      const record = await users.findById(id)
      if (!record) throw new HttpError(401, 'INVALID_TOKEN', '账号不存在，请重新登录')
      return toActiveUser(record)
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
