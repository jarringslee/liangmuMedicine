/** 四端角色：admin/buyer 已实现，grower 建设中，processor 预留 */

export type UserRole = 'admin' | 'grower' | 'processor' | 'buyer'

export type AuthSession = {
  userId: string
  role: UserRole
  displayName: string
  email: string
  roleLabel: string
  /** 种植商账号绑定的合作社（grower 端据此只看自己的批次） */
  growerId?: string
  growerName?: string
}
