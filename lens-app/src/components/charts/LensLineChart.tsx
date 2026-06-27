import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  GradientDefs,
  LensTooltip,
  AXIS_TICK_PROPS,
  GRID_PROPS,
  CHART_COLORS,
  ANIM_DURATION,
  ANIM_EASING,
  useAnimateOnce,
} from './chartUtils'

const BRAND_LINE = 'url(#lens-brand-line)'

export interface LensLine {
  key: string
  color: string
  width?: number
  dashed?: boolean
  dot?: boolean
}

export interface LensLineChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  lines: LensLine[]
  height?: number
  showGrid?: boolean
  showAxes?: boolean
  showTooltip?: boolean
  /** Draws a dashed horizontal baseline at this Y value. */
  referenceY?: number
  /**
   * Y-axis domain. When provided, a hidden axis enforces it even with
   * `showAxes={false}` — pass `['dataMin', 'dataMax']` for series that can go
   * negative, otherwise recharts' default `[0, 'auto']` floors the axis at 0 and
   * flattens any downtrend.
   */
  yDomain?: [number | string, number | string]
  /** Use the brand gradient stroke instead of each line's `color`. */
  gradientStroke?: boolean
  className?: string
}

/**
 * Line chart wrapper (styling.md §Charts). Horizontal grid only, no axis lines,
 * 11px tertiary ticks, transparent background. Supports the brand-gradient
 * stroke (e.g. the Portfolio Vector regression line) and a dashed baseline.
 */
export function LensLineChart({
  data,
  xKey,
  lines,
  height = 200,
  showGrid = true,
  showAxes = false,
  showTooltip = false,
  referenceY,
  yDomain,
  gradientStroke = false,
  className,
}: LensLineChartProps) {
  const animate = useAnimateOnce()
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          {gradientStroke && <GradientDefs />}
          {showGrid && <CartesianGrid {...GRID_PROPS} />}
          {showAxes && (
            <XAxis dataKey={xKey} tick={AXIS_TICK_PROPS} tickLine={false} axisLine={false} />
          )}
          {(showAxes || yDomain) && (
            <YAxis
              hide={!showAxes}
              domain={yDomain ?? ['auto', 'auto']}
              tick={AXIS_TICK_PROPS}
              tickLine={false}
              axisLine={false}
            />
          )}
          {showTooltip && (
            <Tooltip content={<LensTooltip />} cursor={{ stroke: CHART_COLORS.subtle }} />
          )}
          {referenceY !== undefined && (
            <ReferenceLine y={referenceY} stroke={CHART_COLORS.subtle} strokeDasharray="4 4" />
          )}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={gradientStroke ? BRAND_LINE : l.color}
              strokeWidth={l.width ?? 2}
              strokeDasharray={l.dashed ? '5 5' : undefined}
              dot={l.dot ?? false}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
