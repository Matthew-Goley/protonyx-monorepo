import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  LensTooltip,
  AXIS_TICK_PROPS,
  GRID_PROPS,
  CHART_COLORS,
  ANIM_DURATION,
  ANIM_EASING,
  useAnimateOnce,
} from './chartUtils'

export interface LensArea {
  key: string
  /** Hex, used for the stroke and the vertical fill gradient. */
  color: string
  /** Top stop opacity of the fill gradient (fades to transparent). */
  fillOpacity?: number
  strokeWidth?: number
}

export interface LensAreaChartProps {
  data: Array<Record<string, unknown>>
  xKey: string
  areas: LensArea[]
  height?: number
  showGrid?: boolean
  showAxes?: boolean
  showTooltip?: boolean
  /** Formats each value shown in the tooltip box (e.g. as currency). */
  tooltipFormatter?: (value: number | string, name: string) => React.ReactNode
  /** Hide the tooltip header (use when the x value is a meaningless index). */
  hideTooltipLabel?: boolean
  /**
   * Y-axis domain. Defaults to `['dataMin', 'dataMax']` so the fill tracks the
   * data's own range — without this, recharts' default `[0, 'auto']` pins
   * tightly-clustered series (e.g. an equity value near $10k) to a flat line.
   */
  yDomain?: [number | string, number | string]
  className?: string
}

/**
 * Area chart wrapper, primarily for sparklines (e.g. Total Equity). Each area's
 * fill is a vertical gradient from `color` at the top fading to transparent at
 * the bottom; no axes/grid by default. (styling.md §Charts.)
 */
export function LensAreaChart({
  data,
  xKey,
  areas,
  height = 120,
  showGrid = false,
  showAxes = false,
  showTooltip = false,
  tooltipFormatter,
  hideTooltipLabel = false,
  yDomain = ['dataMin', 'dataMax'],
  className,
}: LensAreaChartProps) {
  const animate = useAnimateOnce()
  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            {areas.map((a) => (
              <linearGradient key={a.key} id={`lens-area-${a.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={a.color} stopOpacity={a.fillOpacity ?? 0.15} />
                <stop offset="100%" stopColor={a.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {showGrid && <CartesianGrid {...GRID_PROPS} />}
          {showAxes && (
            <XAxis dataKey={xKey} tick={AXIS_TICK_PROPS} tickLine={false} axisLine={false} />
          )}
          {/* Always present (hidden when axes are off) so the domain is
              data-fitted rather than recharts' flat-pinning [0, 'auto']. */}
          <YAxis
            hide={!showAxes}
            domain={yDomain}
            tick={AXIS_TICK_PROPS}
            tickLine={false}
            axisLine={false}
          />
          {showTooltip && (
            <Tooltip
              content={<LensTooltip formatter={tooltipFormatter} hideLabel={hideTooltipLabel} />}
              cursor={{ stroke: CHART_COLORS.subtle, strokeDasharray: '3 3' }}
            />
          )}
          {areas.map((a) => (
            <Area
              key={a.key}
              type="monotone"
              dataKey={a.key}
              stroke={a.color}
              strokeWidth={a.strokeWidth ?? 1.5}
              fill={`url(#lens-area-${a.key})`}
              baseValue="dataMin"
              activeDot={showTooltip ? { r: 4, fill: a.color, stroke: CHART_COLORS.base, strokeWidth: 2 } : false}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
