/** 四端共用登录身份；API 响应通过适配层转换为页面使用的 AuthSession。 */

export type UserRole = 'admin' | 'grower' | 'processor' | 'buyer'

export type AuthSession = {
  userId: string
  role: UserRole
  displayName: string
  email: string
  roleLabel: string
  organizationId?: string
  organizationName?: string
  /** 种植商账号绑定的合作社（grower 端据此只看自己的批次） */
  growerId?: string
  growerName?: string
  /** 加工商账号绑定的工厂（processor 端据此只看自己工厂的批次） */
  processorId?: string
  processorName?: string
}

export type LoginInput = { account: string; password: string; role: UserRole }

export type ApiUser = {
  id: string
  username: string
  email: string
  displayName: string
  role: UserRole
  organizationId: string | null
  organization: { id: string; name: string; type: 'platform' | 'grower' | 'processor' | 'buyer' } | null
}
