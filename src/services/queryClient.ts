/**
 * 应用级 TanStack Query Client
 * - staleTime 30s：默认 30 秒内不重新拉取（页面内数据基本是用户操作触发）
 * - 关注切换不自动重拉：避免页面焦点切换时打爆 localStorage
 * - windowFocusRefetch 显式按需打开
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})
