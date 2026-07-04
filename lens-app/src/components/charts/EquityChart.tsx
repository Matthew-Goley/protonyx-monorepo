import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CHART_COLORS, ANIM_DURATION, ANIM_EASING, useAnimateOnce } from './chartUtils'

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

export interface EquityChartPoint {
  /** ISO 'YYYY-MM-DD'. */
  date: string
  equity: number
}

export interface EquityChartProps {
  points: EquityChartPoint[]
  timeframe: Timeframe
  /** Stroke + fill color (hex). */
  color?: string
  /** Formats an equity value for the tooltip. */
  valueFormatter: (v: number) => string
  height?: number
}

// ---------------------------------------------------------------------------
// Date helpers (parse 'YYYY-MM-DD' as a local date, not UTC, to avoid off-by-one)
// ---------------------------------------------------------------------------

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

// Compact ruler label, tuned per timeframe so a 1Y axis reads "Jan" while an ALL
// axis reads "Jan '24" and a 1W axis reads "Mon".
function fmtShort(s: string, tf: Timeframe): string {
  const d = parseDate(s)
  switch (tf) {
    case '1D':
    case '1W':
      return d.toLocaleDateString('en-US', { weekday: 'short' })
    case '1M':
    case '3M':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case '1Y':
      return d.toLocaleDateString('en-US', { month: 'short' })
    case 'ALL':
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }
}

// Full date for the tooltip.
function fmtFull(s: string): string {
  return parseDate(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Up to `count` evenly spaced indices across [0, n-1].
function tickIndices(n: number, count = 5): number[] {
  if (n <= count) return Array.from({ length: n }, (_, i) => i)
  const step = (n - 1) / (count - 1)
  return Array.from({ length: count }, (_, i) => Math.round(i * step))
}

// ---------------------------------------------------------------------------
// Tooltip: date header + colored equity value (hover shows the time)
// ---------------------------------------------------------------------------

interface DateTooltipProps {
  active?: boolean
  payload?: Array<{ payload?: EquityChartPoint }>
  color: string
  valueFormatter: (v: number) => string
}
function DateTooltip({ active, payload, color, valueFormatter }: DateTooltipProps) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="rounded-md border border-subtle bg-card px-3 py-2 text-sm shadow-lg">
      <p className="mb-0.5 text-xs text-secondary">{fmtFull(row.date)}</p>
      <p className="flex items-center gap-2 font-medium text-primary">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {valueFormatter(row.equity)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EquityChart — area chart with a "ruler" x-axis: faint full-height guide lines
// through the plot with a date label at the base of each.
// ---------------------------------------------------------------------------

export function EquityChart({
  points,
  timeframe,
  color = CHART_COLORS.green,
  valueFormatter,
  height = 128,
}: EquityChartProps) {
  const animate = useAnimateOnce()

  const n = points.length
  const data = points.map((p, i) => ({ i, date: p.date, equity: p.equity }))
  const ticks = tickIndices(n)
  // Percent position of point i across the plot (matches the numeric x-domain).
  const pos = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50)

  if (n < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-secondary" style={{ height }}>
        Not enough history for this range.
      </div>
    )
  }

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Full-height guide lines behind the chart at each tick position. */}
        {ticks.map((ti) => (
          <span
            key={ti}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-subtle/50"
            style={{ left: `${pos(ti)}%` }}
          />
        ))}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="lens-equity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Hidden numeric x-axis so points map linearly edge-to-edge; the
                ruler guide lines + labels position against the same 0..n-1 domain. */}
            <XAxis dataKey="i" type="number" domain={[0, n - 1]} hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              content={<DateTooltip color={color} valueFormatter={valueFormatter} />}
              cursor={{ stroke: CHART_COLORS.subtle, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={color}
              strokeWidth={2}
              fill="url(#lens-equity-fill)"
              baseValue="dataMin"
              activeDot={{ r: 4, fill: color, stroke: CHART_COLORS.base, strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Ruler labels at the base of each guide line. */}
      <div className="relative mt-2 h-4 text-[11px] text-secondary">
        {ticks.map((ti) => {
          const transform =
            ti === 0 ? 'none' : ti === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)'
          return (
            <span
              key={ti}
              className="absolute top-0 whitespace-nowrap tabular-nums"
              style={{ left: `${pos(ti)}%`, transform }}
            >
              {fmtShort(points[ti].date, timeframe)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
