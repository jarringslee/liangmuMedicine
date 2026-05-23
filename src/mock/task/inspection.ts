/** 任务 · 抽检 / 合规待办（仪表盘「待办」卡片） */

export type PendingInspectionTask = {
  id: string
  title: string
  type: string
  deadline: string
}

export const pendingInspectionTasks: PendingInspectionTask[] = [
  {
    id: 't1',
    title: '「陇南柴胡」新批次产地证明文件复核',
    type: '资质',
    deadline: '今日 18:00',
  },
  {
    id: 't2',
    title: '加工商「滇康药业」设备校准到期提醒',
    type: '合规',
    deadline: '明日',
  },
  {
    id: 't3',
    title: '采购商合同备案 — 批次 YM-2026-YN-GC-0441',
    type: '合同',
    deadline: '2 日内',
  },
]
