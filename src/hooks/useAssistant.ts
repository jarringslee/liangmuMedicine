import { createContext, useContext } from 'react'
import type { AssistantContextValue } from '../types/assistant'

// Context 只连接全局助手与各入口，不替代 TanStack Query 的请求管理。
export const AssistantContext = createContext<AssistantContextValue | null>(null)
export function useAssistant() {
  const value = useContext(AssistantContext)
  if (!value) throw new Error('AI 助手入口必须位于 AssistantProvider 内')
  return value
}
