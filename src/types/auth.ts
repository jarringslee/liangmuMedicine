/** 当前阶段仅实现管理员与采购商两种登录角色 */

export type UserRole = 'admin' | 'buyer'

export type AuthSession = {
  userId: string
  role: UserRole
  displayName: string
  email: string
  roleLabel: string
}
