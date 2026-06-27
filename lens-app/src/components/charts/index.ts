/*
  Lens chart wrapper layer — the only place in the app that imports `recharts`.
  Every chart renders through one of these wrappers; nothing outside this folder
  should import recharts directly. Design rules live in chartUtils.tsx and follow
  styling.md §Charts (see lens-app/CLAUDE.md §6).
*/

export { LensLineChart } from './LensLineChart'
export type { LensLineChartProps, LensLine } from './LensLineChart'

export { LensAreaChart } from './LensAreaChart'
export type { LensAreaChartProps, LensArea } from './LensAreaChart'

export { LensAreaFanChart } from './LensAreaFanChart'
export type { LensAreaFanChartProps, FanBand } from './LensAreaFanChart'

export { LensPieChart } from './LensPieChart'
export type { LensPieChartProps, PieSlice } from './LensPieChart'

export {
  CHART_COLORS,
  PIE_COLORS,
  GradientDefs,
  LensTooltip,
  AXIS_TICK_PROPS,
  GRID_PROPS,
  useAnimateOnce,
} from './chartUtils'
