/** 仪表盘 · 图表原始数据（由页面组装为 ECharts option） */

export const purchaseTrend = {
  /** 折线图 X 轴日期标签 */
  xAxisData: ['4/1', '4/5', '4/9', '4/13', '4/17', '4/21', '4/25', '4/29'],
  /** 备案采购额（万元） */
  seriesData: [82, 91, 88, 102, 95, 110, 118, 128.6],
  seriesName: '备案采购额',
} as const

export const categoryPie = {
  colors: ['#2f6f4e', '#52a37e', '#c9a227', '#6b8cae', '#b08968'],
  data: [
    { value: 28, name: '根茎类' },
    { value: 22, name: '全草类' },
    { value: 18, name: '果实种子类' },
    { value: 16, name: '花叶类' },
    { value: 16, name: '其他' },
  ],
} as const

export const flowBar = {
  categories: ['种植上报', '采收质检', '初加工', '仓储', '深加工', '采购入库', '终端出库'],
  values: [420, 380, 290, 310, 260, 340, 270],
} as const

export const healthGauge = {
  value: 92,
  name: '链路健康度',
} as const
