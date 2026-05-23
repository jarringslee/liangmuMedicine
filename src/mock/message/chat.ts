/** 消息中心 · 会话预览（占位，后续对接 IM / 站内信） */

export type ChatPreviewItem = {
  id: string
  peerName: string
  lastMessage: string
  updatedAt: string
  unread?: number
}

export const mockChatPreviews: ChatPreviewItem[] = [
  {
    id: 'c1',
    peerName: '陇南柴胡基地 · 对接人',
    lastMessage: '产地证明扫描件已上传，请查收。',
    updatedAt: '昨天',
    unread: 1,
  },
  {
    id: 'c2',
    peerName: '平台运营客服',
    lastMessage: '您好，抽检任务编号已生成。',
    updatedAt: '4/28',
    unread: 0,
  },
]
