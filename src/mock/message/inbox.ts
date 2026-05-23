/** 消息中心 · 收件箱（系统 / 邮件 / 聊天汇总） */

export type MessageChannel = 'system' | 'email' | 'chat'

export type InboxMessage = {
  id: string
  channel: MessageChannel
  /**
   * 展示用发件人：系统为「系统消息」、邮件为「邮件通知」等；
   * 用户聊天为用户名（与 senderRole 搭配）。
   */
  senderName: string
  /** 用户聊天时的角色标签，如种植商、加工商 */
  senderRole?: string
  /** 日期时间（展示用） */
  dateLabel: string
  /** 列表一行摘要，超出由 UI 省略 */
  preview: string
  read: boolean
}

/**
 * 全量静态消息（按时间新→旧已排好序，越靠上越新）
 * 未读用于顶栏角标与列表未读态
 */
export const inboxMessages: InboxMessage[] = [
  {
    id: 'm1',
    channel: 'system',
    senderName: '系统消息',
    dateLabel: '2026-04-29 10:32',
    preview: '批次 YM-2026-GS-HQ-0318 触发高风险规则，请尽快在「质检与风控」中处理。',
    read: false,
  },
  {
    id: 'm2',
    channel: 'chat',
    senderName: '袁宇航',
    senderRole: '种植商',
    dateLabel: '2026-04-29 09:50',
    preview: '产地证明与农残报告已补传，请查收并审核，谢谢。',
    read: false,
  },
  {
    id: 'm3',
    channel: 'email',
    senderName: '邮件通知',
    dateLabel: '2026-04-29 08:20',
    preview: '[良木药谷] 您订阅的「西北产区周报」已生成，点击邮件内链接查看完整 PDF。',
    read: false,
  },
  {
    id: 'm4',
    channel: 'system',
    senderName: '系统消息',
    dateLabel: '2026-04-28 18:10',
    preview: '新供应商「滇南本草」提交资质材料，待管理员审核。',
    read: false,
  },
  {
    id: 'm5',
    channel: 'chat',
    senderName: '蒿润园',
    senderRole: '加工商',
    dateLabel: '2026-04-28 16:40',
    preview: '本批甘草初加工环节质检报告编号已同步至平台，请确认节点是否上链成功。',
    read: true,
  },
  {
    id: 'm6',
    channel: 'email',
    senderName: '邮件通知',
    dateLabel: '2026-04-28 11:00',
    preview: '【安全提醒】检测到异常登录尝试，如非本人操作请立即修改密码并联系管理员。',
    read: true,
  },
  {
    id: 'm7',
    channel: 'system',
    senderName: '系统消息',
    dateLabel: '2026-04-28 09:00',
    preview: '本月数据上报进度未达标的合作主体名单已更新，请查看待办事项。',
    read: true,
  },
  {
    id: 'm8',
    channel: 'chat',
    senderName: '陈靖轩',
    senderRole: '采购商',
    dateLabel: '2026-04-27 15:22',
    preview: '合同备案涉及批次 YM-2026-YN-GC-0441 的付款凭证已上传，请协助核对金额与批号是否一致。',
    read: true,
  },
  {
    id: 'm9',
    channel: 'email',
    senderName: '邮件通知',
    dateLabel: '2026-04-27 10:00',
    preview: '[良木药谷] 您有一条待签署的电子签章合同，将于 3 日后过期，请尽快处理。',
    read: true,
  },
  {
    id: 'm10',
    channel: 'system',
    senderName: '系统消息',
    dateLabel: '2026-04-26 19:00',
    preview: '平台将于 5 月 1 日 02:00–04:00 进行维护，期间链上存证与对外查询将短暂不可用。',
    read: true,
  },
]

export function getUnreadMessageCount(): number {
  return inboxMessages.filter((m) => !m.read).length
}

/** 角标用：与未读数一致，随数据变化 */
export const unreadMessageCount = getUnreadMessageCount()

export function getRecentInboxPreview(limit = 5): InboxMessage[] {
  return inboxMessages.slice(0, Math.max(0, limit))
}

export function channelLabel(c: MessageChannel): string {
  const map: Record<MessageChannel, string> = {
    system: '系统',
    email: '邮件',
    chat: '聊天',
  }
  return map[c]
}
