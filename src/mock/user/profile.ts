/** 用户 · 当前登录态展示与个人信息页面数据 */

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

/**
 * 个人信息页展示的扩展字段
 * - admin 走 `employeeNo / department / position` 路径
 * - buyer 走 `company / cooperationSince / preferredCategories` 路径
 * 通用字段：姓名 / 手机 / 邮箱 / 角色 / 最近登录信息
 */
export type UserProfileDetail = {
  displayName: string
  phone: string
  email: string
  roleLabel: string
  lastLoginAt: string
  lastLoginLocation: string
  /** 仅管理员侧使用 */
  employeeNo?: string
  department?: string
  position?: string
  /** 仅采购商侧使用 */
  company?: string
  customerNo?: string
  cooperationSince?: string
  preferredCategories?: string[]
}

export const mockAdminProfileDetail: UserProfileDetail = {
  displayName: mockAdminProfile.displayName,
  employeeNo: 'YM-A-2024001',
  /** 完整号码；列表展示时可脱敏 */
  phone: '15760939570',
  email: mockAdminProfile.email,
  department: '信息技术部',
  position: '系统管理员',
  roleLabel: mockAdminProfile.roleLabel ?? '管理员',
  lastLoginAt: '2026-05-23 09:42:18',
  lastLoginLocation: '陕西省西安市雁塔区 · 联通出口（近似）',
}

/** 管理员资料（演示账号：郑武凯） */
export const mockAdminZhengProfileDetail: UserProfileDetail = {
  displayName: '郑武凯',
  employeeNo: 'YM-A-2024002',
  phone: '13900001234',
  email: '516136122@qq.com',
  department: '运营管理部',
  position: '运营主管',
  roleLabel: '管理员',
  lastLoginAt: '2026-06-10 16:28:05',
  lastLoginLocation: '陕西省西安市未央区 · 移动出口（近似）',
}

export const mockBuyerProfileDetail: UserProfileDetail = {
  displayName: '陈靖轩',
  phone: '13468636970',
  email: '2308096635@qq.com',
  roleLabel: '采购商',
  company: '西安秦岭本草采购贸易有限公司',
  customerNo: 'YM-B-2024003',
  cooperationSince: '2024-09-15',
  preferredCategories: ['根茎类', '果实种子类', '全草类'],
  lastLoginAt: '2026-05-22 21:18:35',
  lastLoginLocation: '陕西省西安市未央区 · 移动出口（近似）',
}

/** 采购商资料（演示账号：曹默然 · 个体） */
export const mockBuyerCaoProfileDetail: UserProfileDetail = {
  displayName: '曹默然',
  phone: '13500006789',
  email: '3072757348@qq.com',
  roleLabel: '采购商',
  company: '个体',
  customerNo: 'YM-B-2025001',
  cooperationSince: '2025-03-01',
  preferredCategories: ['根茎类', '花叶类'],
  lastLoginAt: '2026-06-15 10:05:22',
  lastLoginLocation: '陕西省商洛市商州区 · 电信出口（近似）',
}

/** 种植商资料（演示账号：袁宇航 · 秦岭本草种植合作社） */
export const mockGrowerProfileDetail: UserProfileDetail = {
  displayName: '袁宇航',
  phone: '13700001234',
  email: '3253702912@qq.com',
  roleLabel: '种植商',
  company: '秦岭本草种植合作社',
  customerNo: 'YM-G-2024005',
  cooperationSince: '2024-03-20',
  preferredCategories: ['根茎类', '全草类'],
  lastLoginAt: '2026-05-28 08:12:40',
  lastLoginLocation: '陕西省商洛市商州区 · 电信出口（近似）',
}

/** 加工商资料（演示账号：蒿润圆 · 秦岭本草加工厂） */
export const mockProcessorProfileDetail: UserProfileDetail = {
  displayName: '蒿润圆',
  phone: '13800005678',
  email: '2264523868@qq.com',
  roleLabel: '加工商',
  company: '秦岭本草加工厂',
  customerNo: 'YM-P-2025001',
  cooperationSince: '2025-01-10',
  lastLoginAt: '2026-06-18 14:32:11',
  lastLoginLocation: '陕西省西安市雁塔区 · 移动出口（近似）',
}

/** 兼容旧引用：等同于 mockAdminProfileDetail */
export const mockUserProfileDetail = mockAdminProfileDetail
