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
  /** 种植商账号绑定的合作社（用于「只看自己的批次」） */
  growerId?: string
  growerName?: string
  /** 加工商账号绑定的工厂（用于「只看自己工厂的批次」） */
  processorId?: string
  processorName?: string
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
    userId: 'admin-zhengwukai',
    loginRole: 'admin',
    role: 'admin',
    displayName: '郑武凯',
    email: '516136122@qq.com',
    loginUsername: 'zhengwukai',
    password: 'zhengwukai123',
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
  {
    userId: 'buyer-caomoran',
    loginRole: 'buyer',
    role: 'buyer',
    displayName: '曹默然',
    email: '3072757348@qq.com',
    loginUsername: 'caomoran',
    password: 'caomoran123',
    roleLabel: '采购商',
  },
  {
    userId: 'grower-yuanyuhang',
    loginRole: 'grower',
    role: 'grower',
    displayName: '袁宇航',
    email: '3253702912@qq.com',
    loginUsername: 'yuanyuhang',
    password: 'yuanyuhang123',
    roleLabel: '种植商',
    growerId: 'g-qinling-bencao',
    growerName: '秦岭本草种植合作社',
  },
  {
    userId: 'grower-lijiaying',
    loginRole: 'grower',
    role: 'grower',
    displayName: '李佳英',
    email: '3101016138@qq.com',
    loginUsername: 'lijiaying',
    password: 'lijiaying123',
    roleLabel: '种植商',
    growerId: 'g-taibaishan-daodi',
    growerName: '太白山道地药材基地',
  },
  {
    userId: 'processor-haorunyuan',
    loginRole: 'processor',
    role: 'processor',
    displayName: '蒿润圆',
    email: '2264523868@qq.com',
    loginUsername: 'haorunyuan',
    password: 'haorunyuan123',
    roleLabel: '加工商',
    processorId: 'p-qinling-herb',
    processorName: '秦岭本草加工厂',
  },
  {
    userId: 'processor-yangzhouming',
    loginRole: 'processor',
    role: 'processor',
    displayName: '杨周明',
    email: '2022217461@qq.com',
    loginUsername: 'yangzhouming',
    password: 'yangzhouming123',
    roleLabel: '加工商',
    processorId: 'p-baishan-herb',
    processorName: '白山道地药材加工厂',
  },
]

export function accountToSession(account: StaticAccount): AuthSession {
  return {
    userId: account.userId,
    role: account.role,
    displayName: account.displayName,
    email: account.email,
    roleLabel: account.roleLabel,
    ...(account.growerId
      ? { growerId: account.growerId, growerName: account.growerName }
      : {}),
    ...(account.processorId
      ? { processorId: account.processorId, processorName: account.processorName }
      : {}),
  }
}

export function verifyStaticLogin(
  loginRole: LoginRoleKey,
  mode: 'username' | 'email',
  account: string,
  password: string,
): AuthSession | null {
  const u = account.trim()
  /** 同一 Tab 可能有多个账号，需按账号+密码精确匹配 */
  const row = staticAccounts.find((a) => {
    if (a.loginRole !== loginRole) return false
    return mode === 'username'
      ? u === a.loginUsername
      : u.toLowerCase() === a.email.toLowerCase()
  })
  if (!row || password !== row.password) return null
  return accountToSession(row)
}

export function getDefaultHome(role: UserRole): string {
  switch (role) {
    case 'buyer':
      return '/buyer/herbs'
    case 'grower':
      return '/grower/dashboard'
    case 'processor':
      return '/processor/dashboard'
    default:
      return '/dashboard'
  }
}
