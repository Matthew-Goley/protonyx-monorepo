import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import {
  GradientDefs,
  AXIS_TICK_PROPS,
  GRID_PROPS,
  CHART_COLORS,
  ANIM_DURATION,
  ANIM_EASING,
  useAnimateOnce,
} from './chartUtils'

export interface FanBand {
  upperKey: string
  lowerKey: string
  color: string
  opacity: number
}

export interface LensAreaFanChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  /** Outer to inner; each renders as a filled band between its two keys. */
  bands: FanBand[]
  /** Center (median) line key. */
  medianKey: string
  /** Optional line shown before the "today" marker (the historical lead-in). */
  historicalKey?: string
  /** Data index where the vertical "Today" marker is drawn. */
  todayIndex?: number
  /** Base color (hex, or `url(#lens-brand-line)`) for the median/historical lines. */
  color: string
  height?: number
  /**
   * Y-axis domain. Defaults to `['auto', 'auto']` so the fan fills the chart and
   * negative band values are not clipped — recharts' default `[0, 'auto']` floors
   * the axis at 0, which squashes the fan flat and cuts off losses below zero.
   */
  yDomain?: [number | string, number | string]
  yTickFormatter?: (v: number) => string
  xTickFormatter?: (v: string) => string
  className?: string
}

/**
 * Projection fan (Monte Carlo). Each band is a filled area between an upper and
 * a lower key; the median is a line, with an optional historical line before the
 * "Today" marker. Horizontal grid only, minimal axes. (styling.md §Charts.)
 *
 * recharts draws a band from a single tuple dataKey, so the upper/lower keys are
 * combined here into synthetic `__band{i}` tuple keys before rendering.
 */
export function LensAreaFanChart({
  data,
  xKey,
  bands,
  medianKey,
  historicalKey,
  todayIndex,
  color,
  height = 280,
  yDomain = ['auto', 'auto'],
  yTickFormatter,
  xTickFormatter,
  className,
}: LensAreaFanChartProps) {
  const animate = useAnimateOnce()

  const rows = data.map((d) => {
    const out: Record<string, unknown> = { ...d }
    bands.forEach((b, i) => {
      const lo = d[b.lowerKey]
      const hi = d[b.upperKey]
      out[`__band${i}`] =
        typeof lo === 'number' && typeof hi === 'number' ? [lo, hi] : null
    })
    return out
  })

  const todayX =
    todayIndex !== undefined && data[todayIndex] !== undefined
      ? (data[todayIndex][xKey] as string | number)
      : undefined

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <GradientDefs />
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey={xKey}
            tick={AXIS_TICK_PROPS}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.subtle }}
            interval={0}
            tickFormatter={xTickFormatter}
          />
          <YAxis
            domain={yDomain}
            tick={AXIS_TICK_PROPS}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={yTickFormatter}
          />
          {bands.map((b, i) => (
            <Area
              key={i}
              dataKey={`__band${i}`}
              stroke="none"
              fill={b.color}
              fillOpacity={b.opacity}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
              connectNulls
            />
          ))}
          {historicalKey && (
            <Line
              dataKey={historicalKey}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
              connectNulls
            />
          )}
          <Line
            dataKey={medianKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={animate}
            animationDuration={ANIM_DURATION}
            animationEasing={ANIM_EASING}
            connectNulls
          />
          {todayX !== undefined && (
            <ReferenceLine
              x={todayX}
              stroke={CHART_COLORS.subtle}
              strokeDasharray="4 4"
              label={{ value: 'Today', position: 'top', fill: CHART_COLORS.muted, fontSize: 11 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
