import type { LoginRoleKey } from '../login/roles'
import type { AuthSession, UserRole } from '../../types/auth'

export type StaticAccount = {
  userId: string
  /** 对应登录页 Tab */
  loginRole: LoginRoleKey
  role: UserRole
  displayName: string
  email: string
  loginUsername: string
  password: string
  roleLabel: string
}

/** 静态演示账号（后续改为接口校验） */
export const staticAccounts: StaticAccount[] = [
  {
    userId: 'admin-lijialin',
    loginRole: 'admin',
    role: 'admin',
    displayName: '李佳林',
    email: '1413488450@qq.com',
    loginUsername: 'lijialin',
    password: 'lijialin123',
    roleLabel: '管理员',
  },
  {
    userId: 'buyer-chenjingxuan',
    loginRole: 'buyer',
    role: 'buyer',
    displayName: '陈靖轩',
    email: '2308096635@qq.com',
    loginUsername: 'chenjingxuan',
    password: 'chenjingxuan123',
    roleLabel: '采购商',
  },
]

export function accountToSession(account: StaticAccount): AuthSession {
  return {
    userId: account.userId,
    role: account.role,
    displayName: account.displayName,
    email: account.email,
    roleLabel: account.roleLabel,
  }
}

export function verifyStaticLogin(
  loginRole: LoginRoleKey,
  mode: 'username' | 'email',
  account: string,
  password: string,
): AuthSession | null {
  const row = staticAccounts.find((a) => a.loginRole === loginRole)
  if (!row || password !== row.password) return null

  const u = account.trim()
  if (mode === 'username') {
    return u === row.loginUsername ? accountToSession(row) : null
  }
  return u.toLowerCase() === row.email.toLowerCase() ? accountToSession(row) : null
}

export function getDefaultHome(role: UserRole): string {
  return role === 'buyer' ? '/buyer/herbs' : '/dashboard'
}
