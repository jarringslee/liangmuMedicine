// 弹窗允许查询
// 确认管理员身份
// 按账号与模式建立缓存
// 数据源读取候选
// Query 管理数据、加载和错误


import { useQuery } from '@tanstack/react-query'
import { authMode } from '../config/api'
import { listDispatchRecipients } from '../services/herbDataSource'
import { useAuth } from './useAuth'

/** 出库弹窗打开后，才为当前管理员读取采购组织。 */
export function useDispatchRecipients(enabled = true) {
    const { session, status } = useAuth()

    return useQuery({
        queryKey: [
            'dispatch-recipients',
            authMode,
            session?.userId ?? 'anonymous',
        ],
        queryFn: ({ signal }) => listDispatchRecipients(signal),
        enabled:
            enabled &&
            status === 'authenticated' &&
            session?.role === 'admin',
        staleTime: 0,
        gcTime: 60_000,
        retry: false,
        refetchOnWindowFocus: true,
    })
}