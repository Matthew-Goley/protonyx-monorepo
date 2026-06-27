import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from 'recharts'
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

// Active (hovered) sector lifts slightly: +4px outer radius. recharts drives the
// active sector from hover state, so this is a no-op until a slice is hovered.
function renderActiveSlice(props: any) {
  const outerRadius = props.outerRadius ?? 0
  return <Sector {...props} outerRadius={outerRadius + 4} />
}

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

  const pie = (
    <div style={{ width: size * 2, height }} className="shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={size}
            paddingAngle={2}
            stroke="none"
            activeShape={renderActiveSlice}
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
          ? 'flex flex-1 flex-col gap-2'
          : 'flex flex-wrap gap-x-4 gap-y-2'
      }
    >
      {data.map((s) => (
        <li key={s.name} className="flex items-center gap-2 text-[13px]">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: s.color }}
          />
          <span className="flex-1 text-secondary">{s.name}</span>
          <span className="font-medium text-primary">{s.value.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div
      className={`flex ${
        legendPosition === 'right' ? 'flex-row items-center gap-5' : 'flex-col gap-4'
      } ${className ?? ''}`}
    >
      {pie}
      {legend}
    </div>
  )
}
