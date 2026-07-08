import { useEffect, useRef, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS, ANIM_DURATION, ANIM_EASING, useAnimateOnce } from './chartUtils'

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

export interface EquityChartPoint {
  /** ISO 'YYYY-MM-DD'. */
  date: string
  equity: number
}

/** A contiguous span of the series the user is inspecting, as data indices. */
export interface EquityRange {
  fromIndex: number
  toIndex: number
}

export interface EquityChartProps {
  points: EquityChartPoint[]
  timeframe: Timeframe
  /** Stroke + fill color (hex). */
  color?: string
  height?: number
  /**
   * Reports the span the user is currently inspecting so the parent can show its
   * return: while hovering, [start of chart -> hovered point]; while a click-drag
   * selection is active, [selection start -> selection end]. `null` when neither
   * (parent falls back to the full-window change). Must be a stable callback.
   */
  onActiveRangeChange?: (range: EquityRange | null) => void
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
// Tooltip: date only. The equity at the hovered point is surfaced by the parent
// widget's big readout instead, so the tooltip just marks the time on the axis.
// ---------------------------------------------------------------------------

interface DateTooltipProps {
  active?: boolean
  payload?: Array<{ payload?: EquityChartPoint }>
}
function DateTooltip({ active, payload }: DateTooltipProps) {
  const row = active ? payload?.[0]?.payload : undefined
  if (!row) return null
  return (
    <div className="rounded-md border border-subtle bg-surface/80 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur-md">
      <p className="text-xs font-medium text-primary">{fmtFull(row.date)}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EquityChart — area chart with a "ruler" x-axis: faint full-height guide lines
// through the plot with a date label at the base of each.
// ---------------------------------------------------------------------------

// Pull the hovered data index out of a recharts categorical-chart event state.
// Our dataKey `i` equals the array index, so activeLabel (the x value) is the
// index; activeTooltipIndex is a fallback.
function idxFromState(s: unknown, n: number): number | null {
  const st = s as { activeTooltipIndex?: number | string; activeLabel?: number | string } | null
  if (!st) return null
  const raw = st.activeLabel ?? st.activeTooltipIndex
  if (raw == null || raw === '') return null
  const i = Number(raw)
  if (!Number.isFinite(i)) return null
  return Math.max(0, Math.min(n - 1, Math.round(i)))
}

export function EquityChart({
  points,
  timeframe,
  color = CHART_COLORS.green,
  height = 128,
  onActiveRangeChange,
}: EquityChartProps) {
  const animate = useAnimateOnce()

  const n = points.length
  const data = points.map((p, i) => ({ i, date: p.date, equity: p.equity }))
  const ticks = tickIndices(n)
  // Percent position of point i across the plot (matches the numeric x-domain).
  const pos = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50)

  // Hover index (feature 1) and click-drag selection (feature 2). The selection
  // is a persistent band the user drags out; a plain click (no drag) clears it.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null)
  const dragging = useRef(false)
  const moved = useRef(false)

  // Finalize a drag: keep a real (moved) selection, discard a bare click.
  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    setSel((cur) => (moved.current && cur && cur.start !== cur.end ? cur : null))
  }

  // A drag can end outside the plot; catch the release anywhere.
  useEffect(() => {
    window.addEventListener('mouseup', endDrag)
    return () => window.removeEventListener('mouseup', endDrag)
  }, [])

  // Reset interaction when the underlying series changes (e.g. timeframe switch),
  // so stale indices never point past the new data.
  useEffect(() => {
    setHoverIndex(null)
    setSel(null)
    dragging.current = false
  }, [points])

  // Report the inspected span up to the parent: a real selection wins over hover.
  useEffect(() => {
    if (!onActiveRangeChange) return
    if (sel && sel.start !== sel.end) {
      onActiveRangeChange({
        fromIndex: Math.min(sel.start, sel.end),
        toIndex: Math.max(sel.start, sel.end),
      })
    } else if (hoverIndex != null && hoverIndex > 0) {
      onActiveRangeChange({ fromIndex: 0, toIndex: hoverIndex })
    } else {
      onActiveRangeChange(null)
    }
  }, [sel, hoverIndex, onActiveRangeChange])

  const handleDown = (s: unknown) => {
    const i = idxFromState(s, n)
    if (i == null) return
    dragging.current = true
    moved.current = false
    setSel({ start: i, end: i })
  }
  const handleMove = (s: unknown) => {
    const i = idxFromState(s, n)
    if (i == null) return
    setHoverIndex(i)
    if (dragging.current) {
      moved.current = true
      setSel((cur) => (cur ? { start: cur.start, end: i } : { start: i, end: i }))
    }
  }
  const handleLeave = () => {
    setHoverIndex(null)
    endDrag()
  }

  if (n < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-secondary" style={{ height }}>
        Not enough history for this range.
      </div>
    )
  }

  return (
    <div>
      <div className="relative select-none" style={{ height }}>
        {/* Full-height guide lines behind the chart at each tick position. */}
        {ticks.map((ti) => (
          <span
            key={ti}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-subtle/50"
            style={{ left: `${pos(ti)}%` }}
          />
        ))}
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
            onMouseDown={handleDown}
            onMouseMove={handleMove}
            onMouseUp={endDrag}
            onMouseLeave={handleLeave}
            style={{ cursor: 'crosshair' }}
          >
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
              content={<DateTooltip />}
              cursor={{ stroke: CHART_COLORS.subtle, strokeDasharray: '3 3' }}
            />
            {/* Shaded band marking the click-drag selection (feature 2). */}
            {sel && sel.start !== sel.end && (
              <ReferenceArea
                x1={Math.min(sel.start, sel.end)}
                x2={Math.max(sel.start, sel.end)}
                fill={color}
                fillOpacity={0.14}
                stroke="none"
              />
            )}
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
