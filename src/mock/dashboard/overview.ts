/** 仪表盘 · 概览指标、侧栏菜单配置、AI 摘要文案等 */

export type SummaryIconKey =
  | 'fileSearch'
  | 'medicineBox'
  | 'audit'
  | 'alert'
  | 'team'
  | 'transaction'
  | 'safetyCertificate'
  | 'thunderbolt'

export const summaryCardAccents = [
  'teal',
  'green',
  'gold',
  'red',
  'blue',
  'purple',
  'cyan',
  'lime',
] as const

export type SummaryCardAccent = (typeof summaryCardAccents)[number]

export type SummaryCardItem = {
  title: string
  value: number
  suffix: string
  hint: string
  iconKey: SummaryIconKey
  accent: SummaryCardAccent
}

export const summaryCards: SummaryCardItem[] = [
  {
    title: '在溯批次总数',
    value: 3842,
    suffix: '批',
    hint: '含种植端已建档未完结',
    iconKey: 'fileSearch',
    accent: 'teal',
  },
  {
    title: '今日入库 / 上报',
    value: 126,
    suffix: '条',
    hint: '较昨日 +12%',
    iconKey: 'medicineBox',
    accent: 'green',
  },
  {
    title: '待审核事项',
    value: 8,
    suffix: '项',
    hint: '资质变更与批次复核',
    iconKey: 'audit',
    accent: 'gold',
  },
  {
    title: '风险预警',
    value: 12,
    suffix: '条',
    hint: '含 5 条高风险待处置',
    iconKey: 'alert',
    accent: 'red',
  },
  {
    title: '合作主体',
    value: 56,
    suffix: '家',
    hint: '种植 22 · 加工 18 · 采购 16',
    iconKey: 'team',
    accent: 'blue',
  },
  {
    title: '本月平台交易额',
    value: 128.6,
    suffix: '万元',
    hint: '采购合同备案金额',
    iconKey: 'transaction',
    accent: 'purple',
  },
  {
    title: '质检一次合格率',
    value: 97.4,
    suffix: '%',
    hint: '滚动 30 日',
    iconKey: 'safetyCertificate',
    accent: 'cyan',
  },
  {
    title: '链上存证次数',
    value: 15620,
    suffix: '次',
    hint: '关键节点上链记录',
    iconKey: 'thunderbolt',
    accent: 'lime',
  },
]

export type SecondaryStatItem = {
  label: string
  value: string
  trend: string
}

export const secondaryStats: SecondaryStatItem[] = [
  { label: '种植端地块备案', value: '312 块', trend: '+6 本月' },
  { label: '加工环节质检报告', value: '1,204 份', trend: '覆盖率 99.1%' },
  { label: '采购商活跃数', value: '41 家', trend: '周环比 +3' },
  { label: '溯源码核验次数', value: '28,900 次', trend: '本月累计' },
]

/** 侧栏菜单：iconKey 在页面内映射为 @ant-design/icons */
export type DashboardMenuIconKey =
  | 'dashboard'
  | 'shop'
  | 'experiment'
  | 'truck'
  | 'fileSearch'
  | 'safetyCertificate'
  | 'setting'

export type DashboardMenuItem = {
  key: string
  iconKey: DashboardMenuIconKey
  label: string
}

export const dashboardMenuItems: DashboardMenuItem[] = [
  { key: 'dash', iconKey: 'dashboard', label: '数据概览' },
  { key: 'grower', iconKey: 'shop', label: '种植商管理' },
  { key: 'process', iconKey: 'experiment', label: '加工商管理' },
  { key: 'buyer', iconKey: 'truck', label: '采购商管理' },
  { key: 'trace', iconKey: 'fileSearch', label: '溯源查询' },
  { key: 'qc', iconKey: 'safetyCertificate', label: '质检与风控' },
  { key: 'sys', iconKey: 'setting', label: '系统设置' },
]

/** 侧栏底部上报进度条（0–100） */
export const siderReportProgressPercent = 72

export const aiAnalysisCopy = {
  alertMessage: '西北地区黄芪类批次风险集中度偏高',
  alertDescription:
    '农残、仓储湿度与运输时效三类因子同时触发的概率较上月上升，建议优先复核甘肃、宁夏流向。',
  bodyLead:
    '模型综合质检记录、IoT 传感器与物流节点时效，提示：',
  bodyStrong: '暂停相关产区新增大额采购',
  bodyTail: '，完成复检与产地证明文件核验后再行放行。',
  stepsText: '1. 暂停采购 → 2. 实验室复检 → 3. 风控委员会复审 → 4. 更新批次状态与对外公示',
}

export const platformFooterNote =
  '良木药谷 —— 基于 React + TypeScript 的中药材全链路智能溯源管理平台'
