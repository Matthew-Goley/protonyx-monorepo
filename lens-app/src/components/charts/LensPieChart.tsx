import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ANIM_DURATION, ANIM_EASING, useAnimateOnce } from './chartUtils'

export interface PieSlice {
  name: string
  /** Percentage 0-100. */
  value: number
  color: string
}

export interface LensPieChartProps {
  data: PieSlice[]
  /** Outer radius in px. */
  size?: number
  /** Inner radius in px (donut hole). */
  innerRadius?: number
  showLegend?: boolean
  legendPosition?: 'right' | 'bottom'
  height?: number
  className?: string
  /** Optional node rendered directly beneath the legend list (e.g. a cycle
   *  control), so it is centered under the list rather than the whole widget. */
  legendFooter?: React.ReactNode
}

// Hovered sector lifts by this many px. The chart box is padded by the same
// amount (plus a hair) so the lifted slice never clips the SVG viewport.
const ACTIVE_LIFT = 6
const BOX_PAD = ACTIVE_LIFT + 3

/**
 * Donut pie with a custom legend (no recharts <Legend>). Slice colors come from
 * the data, not a hardcoded palette. Hovering the pie or a legend row lifts the
 * matching slice and highlights the legend row; the donut itself has no labels.
 */
export function LensPieChart({
  data,
  size = 80,
  innerRadius = 52,
  showLegend = true,
  legendPosition = 'right',
  height = 200,
  className,
  legendFooter,
}: LensPieChartProps) {
  const animate = useAnimateOnce()
  // Shared hover index, so the pie and the legend highlight in sync and EITHER
  // one can drive the slice lift. null = nothing hovered.
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeName = activeIndex != null ? (data[activeIndex]?.name ?? null) : null

  // Per-slice outer radius: the active slice lifts, all others stay put. recharts
  // v3 calls this per data point, so the lift is driven by our own state (works
  // whether the hover starts on the pie or on the legend).
  const sliceRadius = (entry: { name?: string }) =>
    entry?.name === activeName ? size + ACTIVE_LIFT : size

  // Box is the diameter plus padding on every side, so a lifted slice has room
  // to grow without clipping against the SVG viewport edge.
  const box = size * 2 + BOX_PAD * 2
  const boxHeight = Math.max(height, box)

  const pie = (
    <div style={{ width: box, height: boxHeight }} className="relative shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={sliceRadius}
            paddingAngle={2}
            stroke="none"
            onMouseEnter={(_: unknown, i: number) => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            isAnimationActive={animate}
            animationDuration={ANIM_DURATION}
            animationEasing={ANIM_EASING}
          >
            {data.map((s, i) => (
              <Cell key={i} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )

  const legend = showLegend && (
    <div
      className={legendPosition === 'right' ? 'flex flex-1 flex-col' : 'flex flex-col'}
      // With a footer, the column is fixed to the pie height so the footer (the
      // cycle control) is pinned to the bottom at a constant vertical position,
      // regardless of item count. The list fills the space above it and scrolls.
      style={legendPosition === 'right' && legendFooter ? { height: boxHeight } : undefined}
    >
      {/* px-2 gives the row hover box's -mx-2 bleed room on both sides so the
          overflow-x clip (from overflow-y-auto) doesn't shave off its left edge. */}
      <ul
        className={
          legendPosition === 'right'
            ? `flex flex-col gap-1 overflow-y-auto overflow-x-hidden px-2${
                legendFooter ? ' min-h-0 flex-1' : ''
              }`
            : 'flex flex-wrap gap-x-2 gap-y-1'
        }
        // Without a footer, the list simply caps at the pie height and scrolls.
        style={legendPosition === 'right' && !legendFooter ? { maxHeight: boxHeight } : undefined}
      >
        {data.map((s, i) => {
          const active = i === activeIndex
          return (
            <li
              key={s.name}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              // Hover box mirrors the Portfolio Momentum rungs: a rounded, tinted
              // panel in the slice's own color on hover.
              className="-mx-2 flex cursor-default items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors duration-200 ease-out"
              style={{ backgroundColor: active ? `${s.color}1f` : 'transparent' }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-200 ease-out"
                style={{ backgroundColor: s.color, transform: active ? 'scale(1.4)' : 'scale(1)' }}
              />
              <span
                className={`flex-1 transition-colors duration-200 ease-out ${
                  active ? 'font-semibold text-white' : 'text-secondary'
                }`}
              >
                {s.name}
              </span>
              <span
                className={`transition-colors duration-200 ease-out ${
                  active ? 'font-semibold text-white' : 'font-medium text-primary'
                }`}
              >
                {s.value.toFixed(1)}%
              </span>
            </li>
          )
        })}
      </ul>
      {legendFooter}
    </div>
  )

  return (
    <div
      className={`flex ${
        legendPosition === 'right' ? 'flex-row items-center gap-8' : 'flex-col gap-4'
      } ${className ?? ''}`}
    >
      {pie}
      {legend}
    </div>
  )
}
