import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authMode } from '../config/api'
import { useAuth } from './useAuth'
import { listChatContacts, listChatConversations, listChatHistory, openChat, readChat, sendChat } from '../services/chatDataSource'
import type { SendChatInput } from '../types/chat'

export const chatKey = (userId: string | undefined) => ['human-chat', authMode, userId ?? 'anonymous'] as const
export function useChatConversations() {
  const { session, isAuthenticated } = useAuth()
  return useQuery({ queryKey: [...chatKey(session?.userId), 'conversations'],
    queryFn: ({ signal }) => listChatConversations(signal), enabled: isAuthenticated && authMode === 'api',
    // Socket 断开时仍能补查；后台标签默认不轮询。
    refetchInterval: 20_000, retry: 1, refetchOnWindowFocus: true })
}
export function useChatContacts(search: string) {
  const { session, isAuthenticated } = useAuth()
  const client = useQueryClient()
  const key = chatKey(session?.userId)
  const query = useQuery({ queryKey: [...key, 'contacts', search],
    queryFn: ({ signal }) => listChatContacts(search, signal),
    enabled: isAuthenticated && authMode === 'api', retry: 1 })
  const open = useMutation({ mutationFn: openChat, retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: [...key, 'conversations'] }) })
  return { query, open }
}
export function useChatHistory(id: string) {
  const { session, isAuthenticated } = useAuth()
  const client = useQueryClient()
  const key = chatKey(session?.userId)
  const historyKey = [...key, 'history', id] as const
  const query = useInfiniteQuery({ queryKey: historyKey,
    queryFn: ({ pageParam, signal }) => listChatHistory(id, pageParam, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.nextBefore ?? undefined,
    enabled: isAuthenticated && authMode === 'api' && !!id, retry: 1,
    refetchInterval: 20_000, refetchOnWindowFocus: true })
  const send = useMutation({ mutationFn: (input: SendChatInput) => sendChat(id, input), retry: false,
    onSuccess: () => { void client.invalidateQueries({ queryKey: historyKey })
      void client.invalidateQueries({ queryKey: [...key, 'conversations'] }) } })
  const read = useMutation({ mutationFn: (sequence: number) => readChat(id, sequence), retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: [...key, 'conversations'] }) })
  // 新页/旧页可能在刷新期间重叠，用服务端 ID 去重后按 sequence 排序。
  const messages = [...new Map((query.data?.pages.flatMap((page) => page.items) ?? [])
    .map((item) => [item.id, item])).values()].sort((a, b) => a.sequence - b.sequence)
  return { query, send, read, messages }
}
