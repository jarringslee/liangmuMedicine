import type { UserRole } from '../types/auth'

export type RoleNavigation = {
  homePath: string
  homeLabel: string
  resourcePath: string
  resourceLabel: string
}

const roleNavigation: Record<UserRole, RoleNavigation> = {
  admin: {
    homePath: '/dashboard',
    homeLabel: '管理员端',
    resourcePath: '/admin/herbs',
    resourceLabel: '药材管理',
  },
  grower: {
    homePath: '/grower/dashboard',
    homeLabel: '种植商端',
    resourcePath: '/grower/batches',
    resourceLabel: '我的批次',
  },
  processor: {
    homePath: '/processor/dashboard',
    homeLabel: '加工商端',
    resourcePath: '/processor/batches',
    resourceLabel: '加工批次',
  },
  buyer: {
    homePath: '/buyer/herbs',
    homeLabel: '采购商端',
    resourcePath: '/buyer/herbs',
    resourceLabel: '药材列表',
  },
}

export function getRoleNavigation(role: UserRole): RoleNavigation {
  return roleNavigation[role]
}

export function getDefaultHome(role: UserRole): string {
  return getRoleNavigation(role).homePath
}
