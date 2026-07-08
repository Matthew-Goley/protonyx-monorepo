import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  EquityChart,
  CHART_COLORS,
  type Timeframe,
  type EquityChartPoint,
  type EquityRange,
} from '@/components/charts'
import { VerticalCycleControl } from '@/components/common/CycleControl'
import { RollingNumber } from '@/components/common/RollingNumber'
import { formatCurrency, formatSignedCurrency, formatPercent } from '@/lib/lensData'

/*
  TimeframeAreaChart — the shared "area chart + timeframe stepper + period-return
  readout" surface. It is the single implementation behind both the dashboard
  Portfolio Value widget and the Markets / searched-ticker price chart, so the two
  behave identically: a VerticalCycleControl steps the timeframe, EquityChart draws
  the ruler-axis area with hover + click-drag range inspection, the signed $/%
  readout reports the change over the inspected span (falling back to the full
  window), and the chart crossfades/zooms on a timeframe step. Pass `showValue` to
  render the large value readout (Portfolio Value) or omit it (ticker page keeps
  its live price in the header instead).
*/

const DEFAULT_TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

// Lookback window per timeframe, in calendar days (ALL = the whole curve).
const TF_DAYS: Record<Timeframe, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '1Y': 366,
  ALL: Infinity,
}

// Zoom-transition tuning. Window width in days ranks the timeframes so a step's
// direction is width-based (handles the cycler wraparound).
const ZOOM_MS = 460
const ZOOM_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'

function dateMs(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
}

// Slice the full (max-range) series down to the selected timeframe window. Data is
// daily-close only, so 1D / 1W are coarse (a handful of closes). Falls back to
// `synth(tf)` (e.g. a slope-synthesized line) when real history is unavailable.
function windowPoints(
  all: EquityChartPoint[],
  tf: Timeframe,
  synth?: (tf: Timeframe) => EquityChartPoint[],
): EquityChartPoint[] {
  if (all.length >= 2) {
    if (tf === 'ALL') return all
    const end = dateMs(all[all.length - 1].date)
    const cutoff = end - TF_DAYS[tf] * 86400000
    const win = all.filter((p) => dateMs(p.date) >= cutoff)
    return win.length >= 2 ? win : all.slice(-2)
  }
  return synth ? synth(tf) : all
}

export interface TimeframeAreaChartProps {
  /** Full daily series at max range; windowed internally per timeframe. */
  all: EquityChartPoint[]
  /** Fallback series for a timeframe when `all` has fewer than 2 points. */
  synth?: (tf: Timeframe) => EquityChartPoint[]
  /** Timeframe options for the stepper. Defaults to 1D / 1W / 1M / 3M / 1Y / ALL. */
  timeframes?: Timeframe[]
  /** Initial timeframe (must be in `timeframes`). Defaults to 1Y. */
  defaultTimeframe?: Timeframe
  height?: number
  /** Render the large value readout (equity / price at the inspected point). */
  showValue?: boolean
  /** Live value shown in the big readout when idle (equity / current price). */
  liveValue: number
  /** Optional heading to the left of the readout block (e.g. "Portfolio Value"). */
  title?: string
  /**
   * Prominence of the signed $/% period-return readout. `'sm'` (default) is the
   * small secondary line under the big value (Portfolio Value widget); `'lg'`
   * makes it the panel headline (metric-sized, header-ish) for surfaces with no
   * big value readout (the Commodity price chart).
   */
  readoutSize?: 'sm' | 'lg'
}

export function TimeframeAreaChart({
  all,
  synth,
  timeframes = DEFAULT_TIMEFRAMES,
  defaultTimeframe = '1Y',
  height = 190,
  showValue = false,
  liveValue,
  title,
  readoutSize = 'sm',
}: TimeframeAreaChartProps) {
  const [tfIndex, setTfIndex] = useState(() => {
    const i = timeframes.indexOf(defaultTimeframe)
    return i >= 0 ? i : Math.max(0, timeframes.length - 1)
  })
  const timeframe = timeframes[tfIndex]

  const points = useMemo(() => windowPoints(all, timeframe, synth), [all, timeframe, synth])

  const firstEq = points[0]?.equity ?? liveValue
  const lastEq = points[points.length - 1]?.equity ?? liveValue
  // The big number + chart color track the full-window change and stay stable.
  const windowUp = lastEq - firstEq >= 0
  const numberColor = windowUp ? 'text-accent-green' : 'text-accent-red'
  const chartColor = windowUp ? CHART_COLORS.green : CHART_COLORS.red

  // Span the user is inspecting on the chart (hover -> start..point, or a
  // click-drag selection -> start..end); null falls back to the full window.
  const [activeRange, setActiveRange] = useState<EquityRange | null>(null)
  const handleActiveRange = useCallback((r: EquityRange | null) => setActiveRange(r), [])
  // Drop a stale inspection span when the timeframe (and thus points) changes.
  useEffect(() => setActiveRange(null), [timeframe])

  const fromEq = activeRange ? points[activeRange.fromIndex]?.equity ?? firstEq : firstEq
  const toEq = activeRange ? points[activeRange.toIndex]?.equity ?? lastEq : lastEq
  const readoutDollars = toEq - fromEq
  const readoutPct = fromEq ? (readoutDollars / fromEq) * 100 : 0
  const readoutColor = readoutDollars >= 0 ? 'text-accent-green' : 'text-accent-red'

  // The big readout shows the value at the point being inspected on the chart
  // (hovered point or selection end), falling back to the live value when idle.
  const displayValue = activeRange ? toEq : liveValue

  const stepTf = (delta: number) =>
    setTfIndex((i) => (i + delta + timeframes.length) % timeframes.length)

  // ---- Zoom/slide transition on timeframe change --------------------------
  // On a timeframe step the chart crossfades: the incoming window animates in
  // (zoom-in grows the recent slice from the right; zoom-out settles from a
  // right-anchored enlargement) while a snapshot of the old window animates out
  // over it, so you briefly see where you were. Direction is decided by comparing
  // window widths (TF_DAYS), which also handles the cycler wraparound. Uses the
  // Web Animations API on wrapper refs so EquityChart is never remounted (its
  // hover/range state is preserved).
  const liveRef = useRef<HTMLDivElement>(null)
  const outRef = useRef<HTMLDivElement>(null)
  const prevRef = useRef<{ points: EquityChartPoint[]; timeframe: Timeframe; color: string } | null>(
    null,
  )
  const animKeyRef = useRef(0)
  const [outgoing, setOutgoing] = useState<{
    points: EquityChartPoint[]
    timeframe: Timeframe
    color: string
    dir: 'in' | 'out'
    key: number
  } | null>(null)

  useEffect(() => {
    const before = prevRef.current
    prevRef.current = { points, timeframe, color: chartColor }
    // First render, or a non-timeframe re-render (history load / color flip).
    if (!before || before.timeframe === timeframe) return

    const dir: 'in' | 'out' = TF_DAYS[timeframe] > TF_DAYS[before.timeframe] ? 'out' : 'in'
    const key = ++animKeyRef.current

    // Animate the (already re-rendered, new-data) live chart in.
    const enter =
      dir === 'in'
        ? [{ transform: 'scaleX(0.6)', opacity: 0.25 }, { transform: 'scaleX(1)', opacity: 1 }]
        : [{ transform: 'scaleX(1.7)', opacity: 0.25 }, { transform: 'scaleX(1)', opacity: 1 }]
    liveRef.current?.animate(enter, { duration: ZOOM_MS, easing: ZOOM_EASING })

    setOutgoing({ points: before.points, timeframe: before.timeframe, color: before.color, dir, key })
    const t = setTimeout(() => setOutgoing((cur) => (cur && cur.key === key ? null : cur)), ZOOM_MS)
    return () => clearTimeout(t)
  }, [timeframe, points, chartColor])

  // Animate the outgoing snapshot out once it has mounted on top.
  useEffect(() => {
    if (!outgoing || !outRef.current) return
    const leave =
      outgoing.dir === 'in'
        ? [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(1.7)', opacity: 0 }]
        : [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(0.6)', opacity: 0 }]
    outRef.current.animate(leave, { duration: ZOOM_MS, easing: ZOOM_EASING, fill: 'forwards' })
  }, [outgoing])

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          {title && <h3 className="text-xl font-semibold text-primary">{title}</h3>}
          {/* Value at the inspected point (hover / selection), else live value. */}
          {showValue && (
            <RollingNumber
              value={formatCurrency(displayValue)}
              className={`mt-2 block text-[28px] font-semibold tracking-[-0.02em] ${numberColor}`}
            />
          )}
          {/* Change over the span the user is inspecting on the chart (hovered
              point or click-drag selection), else the full timeframe window.
              `lg` promotes it to the panel headline (Commodity); `sm` keeps it a
              secondary line under the big value (Portfolio Value widget). */}
          {readoutSize === 'lg' ? (
            <p
              className={`flex items-baseline gap-3 text-[28px] font-semibold tracking-[-0.02em] ${readoutColor}`}
            >
              <RollingNumber value={formatSignedCurrency(readoutDollars)} />
              <RollingNumber value={formatPercent(readoutPct)} />
            </p>
          ) : (
            <p className={`mt-1 flex items-center text-sm ${readoutColor}`}>
              <RollingNumber value={formatSignedCurrency(readoutDollars)} />
              &nbsp;&nbsp;
              <RollingNumber value={formatPercent(readoutPct)} />
            </p>
          )}
        </div>
        {/* Vertical up/down cycler steps the timeframe. */}
        <VerticalCycleControl label={timeframe} onPrev={() => stepTf(-1)} onNext={() => stepTf(1)} />
      </div>

      {/* Relative stage; clip only while a zoom is in flight so the tooltip is
          never clipped at rest. */}
      <div className={`relative mt-3 ${outgoing ? 'overflow-hidden' : ''}`}>
        <div ref={liveRef} style={{ transformOrigin: '100% 50%' }}>
          <EquityChart
            points={points}
            timeframe={timeframe}
            color={chartColor}
            height={height}
            onActiveRangeChange={handleActiveRange}
          />
        </div>
        {outgoing && (
          <div
            ref={outRef}
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ transformOrigin: '100% 50%' }}
          >
            <EquityChart
              points={outgoing.points}
              timeframe={outgoing.timeframe}
              color={outgoing.color}
              height={height}
            />
          </div>
        )}
      </div>
    </>
  )
}
