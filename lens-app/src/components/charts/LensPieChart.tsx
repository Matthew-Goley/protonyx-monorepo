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
}

// Hovered sector lifts by this many px. The chart box is padded by the same
// amount (plus a hair) so the lifted slice never clips the SVG viewport.
const ACTIVE_LIFT = 6
const BOX_PAD = ACTIVE_LIFT + 3

/**
 * Donut pie with a custom legend (no recharts <Legend>). Slice colors come from
 * the data, not a hardcoded palette. Empty center, no slice labels.
 */
export function LensPieChart({
  data,
  size = 80,
  innerRadius = 52,
  showLegend = true,
  legendPosition = 'right',
  height = 200,
  className,
}: LensPieChartProps) {
  const animate = useAnimateOnce()
  // Shared hover index, so the pie and the legend highlight in sync and EITHER
  // one can drive the slice lift. null = nothing hovered.
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const activeName = activeIndex != null ? data[activeIndex]?.name : null

  // Per-slice outer radius: the active slice lifts, all others stay put. recharts
  // v3 calls this per data point, so the lift is driven by our own state (works
  // whether the hover starts on the pie or on the legend).
  const sliceRadius = (entry: { name?: string }) =>
    entry?.name === activeName ? size + ACTIVE_LIFT : size

  // Box is the diameter plus padding on every side, so a lifted slice has room
  // to grow without clipping against the SVG viewport edge.
  const box = size * 2 + BOX_PAD * 2

  const pie = (
    <div style={{ width: box, height: Math.max(height, box) }} className="shrink-0">
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
    <ul
      className={
        legendPosition === 'right'
          ? 'flex flex-1 flex-col gap-2 pl-2'
          : 'flex flex-wrap gap-x-4 gap-y-2'
      }
    >
      {data.map((s, i) => {
        const active = i === activeIndex
        return (
          <li
            key={s.name}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            className="flex cursor-default items-center gap-2 text-[13px]"
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
