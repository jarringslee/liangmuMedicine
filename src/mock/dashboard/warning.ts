/** 仪表盘 · 风险预警列表 */

export type WarningItem = {
  id: string
  name: string
  issue: string
  level: 'high' | 'medium' | 'low'
  time: string
}

export const mockWarnings: WarningItem[] = [
  {
    id: 'w1',
    name: '黄芪（甘肃产地）',
    issue: '农残检测：滴滴涕代谢物疑似超标',
    level: 'high',
    time: '29 分钟前',
  },
  {
    id: 'w2',
    name: '当归（仓储批次 YM-2026-SC-DG-0297）',
    issue: '仓储湿度连续 6 小时高于阈值，霉变风险上升',
    level: 'medium',
    time: '1 小时前',
  },
  {
    id: 'w3',
    name: '甘草（运输途中）',
    issue: '冷链中断超过允许时长，可能影响有效成分稳定性',
    level: 'high',
    time: '3 小时前',
  },
  {
    id: 'w4',
    name: '党参（初加工）',
    issue: '二氧化硫熏蒸残留接近上限',
    level: 'medium',
    time: '昨日',
  },
]
