import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import type { BarSeriesOption, PieSeriesOption } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import type { GridComponentOption, LegendComponentOption, TooltipComponentOption } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/esm/core'

// 只注册现有看板使用的图表、坐标系/提示/图例及 Canvas 渲染器。
echarts.use([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

export type DashboardChartOption = echarts.ComposeOption<
  BarSeriesOption | PieSeriesOption | GridComponentOption | LegendComponentOption | TooltipComponentOption
>

export default function DashboardChart({ option }: { option: DashboardChartOption }) {
  return <ReactEChartsCore
    echarts={echarts}
    option={option}
    opts={{ renderer: 'canvas' }}
    style={{ height: 300 }}
    notMerge
    lazyUpdate
  />
}
