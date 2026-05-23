/** 登录页 · 四端角色 Tab（仅管理员分配了演示账号） */

export type LoginRoleKey = 'admin' | 'grower' | 'processor' | 'buyer'

export const loginRoleTabs: { key: LoginRoleKey; label: string }[] = [
  { key: 'admin', label: '管理员' },
  { key: 'grower', label: '种植商' },
  { key: 'processor', label: '加工商' },
  { key: 'buyer', label: '采购商' },
]
