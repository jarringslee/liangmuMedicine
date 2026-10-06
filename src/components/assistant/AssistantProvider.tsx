import type { PropsWithChildren } from 'react'
import type { AuthSession } from '../../types/auth'
import { useAuth } from '../../hooks/useAuth'
import { AssistantContext } from '../../hooks/useAssistant'
import { useAssistantConversation } from '../../hooks/useAssistantConversation'
import { assistantSessionKey } from '../../services/assistantSession'
import AssistantDrawer from './AssistantDrawer'

export default function AssistantProvider({ children }: PropsWithChildren) {
    const { session, isAuthenticated } = useAuth()
    if (!isAuthenticated || !session) return children
    // 登录身份变化时卸载旧客户端会话并取消请求；不删除账号的数据库历史。
    return <AssistantSession key={assistantSessionKey(session)} session={session}>
        {children}
    </AssistantSession>
}

function AssistantSession({ session, children }: PropsWithChildren<{ session: AuthSession }>) {
    const value = useAssistantConversation(session)
    return <AssistantContext.Provider value={value}>
        {children}
        <AssistantDrawer />
    </AssistantContext.Provider>
}
