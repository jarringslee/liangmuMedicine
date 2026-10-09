import { useQuery } from '@tanstack/react-query'
import { authMode } from '../config/api'
import { getPublicTraceByCode } from '../services/herbDataSource'
import { isTraceCode } from '../utils/traceCode'

export function usePublicTrace(traceCode: string | undefined) {
    const code = (traceCode ?? '').trim().toUpperCase()

    return useQuery({
        // 与登录后的完整详情缓存分开，demo/API 之间也不混用。
        queryKey: ['public-trace', authMode, code],

        queryFn: ({ signal }) => getPublicTraceByCode(code, signal),

        enabled: isTraceCode(code),

        // 重新访问时检查最新公开资格，不长期使用旧审核状态。
        staleTime: 0,
        gcTime: 60_000,
        refetchOnWindowFocus: true,

        // 失败交给页面展示，由用户主动重试。
        retry: false,
    })
}