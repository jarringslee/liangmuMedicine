import { useQuery } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { herbQueryKeys } from './useHerbBatches'
import { getDashboardOverview } from '../services/dashboardDataSource'

export function useDashboardOverview() {
    const { session, isAuthenticated } = useAuth()

    return useQuery({
        // 挂在批次缓存前缀下：现有 mutation 成功后也能使看板失效。
        // 再加身份维度，不能让不同账号复用平台统计缓存。
        queryKey: [
            ...herbQueryKeys.all, 'overview',
            session?.userId ?? 'anonymous', session?.role, session?.organizationId,
        ],
        queryFn: ({ signal }) => getDashboardOverview(signal),
        enabled: isAuthenticated && session?.role === 'admin',
        staleTime: 15_000,
        retry: false,
        refetchOnWindowFocus: true,
    })
}