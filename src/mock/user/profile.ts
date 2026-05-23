/** 用户 · 当前登录态展示（顶栏头像旁等） */

export type AdminProfile = {
  displayName: string
  email: string
  roleLabel?: string
  /** 管理员端静态演示：用户名登录用 */
  loginUsername?: string
}

export const mockAdminProfile: AdminProfile = {
  displayName: '李佳林',
  email: '1413488450@qq.com',
  roleLabel: '管理员',
  loginUsername: 'lijialin',
}

/**
 * 静态假登录（仅管理员 Tab + 匹配账号密码时通过）
 * 密码字段仅用于前端演示，后续对接接口后删除。
 */
export const mockStaticAdminCredentials = {
  password: 'lijialin123',
} as const

/** 个人信息页展示的扩展字段（可与接口对齐） */
export type UserProfileDetail = {
  displayName: string
  employeeNo: string
  phone: string
  email: string
  department: string
  position: string
  roleLabel: string
  lastLoginAt: string
  /** 最近一次登录 IP / 地点展示（静态） */
  lastLoginLocation: string
}

export const mockUserProfileDetail: UserProfileDetail = {
  displayName: mockAdminProfile.displayName,
  employeeNo: 'YM-A-2024001',
  /** 完整号码；列表展示时可脱敏 */
  phone: '13800137820',
  email: mockAdminProfile.email,
  department: '信息技术部',
  position: '系统管理员',
  roleLabel: mockAdminProfile.roleLabel ?? '管理员',
  lastLoginAt: '2026-04-29 14:32:08',
  lastLoginLocation: '北京市朝阳区 · 联通出口（近似）',
}
