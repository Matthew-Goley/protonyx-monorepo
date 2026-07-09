import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
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

export interface ProjectionComparePoint {
  label: string
  hist: number | null
  current: number | null
  lens: number | null
  currentBand: [number, number] | null
  lensBand: [number, number] | null
  lensInnerBand: [number, number] | null
}

export interface ProjectionCompareChartProps {
  data: ProjectionComparePoint[]
  /** Row index the "Today" divider is drawn at. */
  todayIndex: number
  height?: number
  showBands?: boolean
  /**
   * Fixed y domain. Pass one whenever the same chart renders several projection
   * methods: recharts' default `'auto'` rescales per method, so the lines jump
   * vertically on every switch. Build it with `projectionYDomain()`.
   */
  yDomain?: [number, number]
  valueFormatter?: (v: number) => string
  /** Axis tick formatter; defaults to a compact currency. */
  tickFormatter?: (v: number) => string
  className?: string
}

const CURRENT_COLOR = CHART_COLORS.secondary

function compactCurrency(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
  return `$${v.toFixed(0)}`
}

/*
  Tooltip for the two-line comparison. Historical rows all share an empty x
  label, so the hovered row is read out of the recharts payload rather than by
  label lookup (same approach as LensAreaFanChart's FanTooltip).
*/
interface CompareTooltipProps {
  active?: boolean
  payload?: Array<{ payload?: Record<string, unknown> }>
  valueFormatter: (v: number) => string
}
function CompareTooltip({ active, payload, valueFormatter }: CompareTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload.find((p) => p.payload)?.payload
  if (!row) return null

  const hist = typeof row.hist === 'number' ? row.hist : null
  const current = typeof row.current === 'number' ? row.current : null
  const lens = typeof row.lens === 'number' ? row.lens : null

  // Before "Today" only the real curve exists.
  if (hist != null && current == null) {
    return (
      <div className="rounded-md border border-subtle bg-card px-3 py-2 text-sm shadow-lg">
        <p className="mb-1 text-xs text-secondary">Actual</p>
        <p className="font-medium text-primary">{valueFormatter(hist)}</p>
      </div>
    )
  }
  if (current == null || lens == null) return null

  const delta = lens - current
  return (
    <div className="rounded-md border border-subtle bg-card px-3 py-2 text-sm shadow-lg">
      {typeof row.label === 'string' && row.label && (
        <p className="mb-1.5 text-xs text-secondary">{row.label}</p>
      )}
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CURRENT_COLOR }} />
        <span className="text-secondary">Current</span>
        <span className="ml-auto font-medium text-primary">{valueFormatter(current)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: '#38bdf8' }} />
        <span className="text-secondary">With Lens</span>
        <span className="ml-auto font-medium text-primary">{valueFormatter(lens)}</span>
      </div>
      {Math.abs(delta) > 0.5 && (
        <p
          className="mt-1.5 border-t border-subtle pt-1.5 text-right text-xs font-medium"
          style={{ color: delta >= 0 ? CHART_COLORS.green : CHART_COLORS.red }}
        >
          {delta >= 0 ? '+' : '-'}
          {valueFormatter(Math.abs(delta))}
        </p>
      )}
    </div>
  )
}

/**
 * Current portfolio vs the portfolio with Lens projections applied, on one pair
 * of axes: the real equity curve to the left of "Today", two projected lines to
 * the right, each with an optional confidence band. The Lens line carries the
 * brand gradient; the current line is a plain slate stroke so the comparison
 * reads at a glance. (styling.md §Charts: horizontal grid only, 11px axis ticks.)
 */
export function ProjectionCompareChart({
  data,
  todayIndex,
  height = 420,
  showBands = true,
  yDomain,
  valueFormatter,
  tickFormatter,
  className,
}: ProjectionCompareChartProps) {
  const animate = useAnimateOnce()
  const fmtValue = valueFormatter ?? compactCurrency
  const fmtTick = tickFormatter ?? compactCurrency
  const todayLabel = data[todayIndex]?.label ?? 'Today'

  return (
    <div className={className} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <GradientDefs />
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK_PROPS}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.subtle }}
            interval={0}
          />
          <YAxis
            domain={yDomain ?? ['auto', 'auto']}
            allowDataOverflow={yDomain !== undefined}
            tick={AXIS_TICK_PROPS}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={fmtTick}
          />
          <Tooltip
            cursor={{ stroke: CHART_COLORS.subtle, strokeDasharray: '3 3' }}
            content={<CompareTooltip valueFormatter={fmtValue} />}
          />

          {showBands && (
            <Area
              dataKey="currentBand"
              stroke="none"
              fill={CHART_COLORS.muted}
              fillOpacity={0.14}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
              connectNulls
            />
          )}
          {showBands && (
            <Area
              dataKey="lensBand"
              stroke="none"
              fill="#38bdf8"
              fillOpacity={0.1}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
              connectNulls
            />
          )}
          {showBands && (
            <Area
              dataKey="lensInnerBand"
              stroke="none"
              fill="#38bdf8"
              fillOpacity={0.12}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
              connectNulls
            />
          )}

          {/* Real equity curve, left of Today. */}
          <Line
            dataKey="hist"
            stroke={CHART_COLORS.muted}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.secondary, stroke: CHART_COLORS.base, strokeWidth: 2 }}
            isAnimationActive={animate}
            animationDuration={ANIM_DURATION}
            animationEasing={ANIM_EASING}
            connectNulls
          />
          {/* Hold as-is. */}
          <Line
            dataKey="current"
            stroke={CURRENT_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, fill: CURRENT_COLOR, stroke: CHART_COLORS.base, strokeWidth: 2 }}
            isAnimationActive={animate}
            animationDuration={ANIM_DURATION}
            animationEasing={ANIM_EASING}
            connectNulls
          />
          {/* With Lens projections applied. */}
          <Line
            dataKey="lens"
            stroke="url(#lens-brand-line)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: '#38bdf8', stroke: CHART_COLORS.base, strokeWidth: 2 }}
            isAnimationActive={animate}
            animationDuration={ANIM_DURATION}
            animationEasing={ANIM_EASING}
            connectNulls
          />

          <ReferenceLine
            x={todayLabel}
            stroke={CHART_COLORS.subtle}
            strokeDasharray="4 4"
            label={{ value: 'Today', position: 'top', fill: CHART_COLORS.muted, fontSize: 11 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
