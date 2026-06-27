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
import { type ProjectionPoint } from '@/lib/lensData'

/**
 * Monte Carlo projection fan (styling.md §Charts): brand-gradient line + area
 * fill beneath, horizontal grid lines only (no vertical), transparent
 * background, no chart border, 11px tertiary axis labels.
 */
export function MonteCarloChart({ points }: { points: ProjectionPoint[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="mc-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="mc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#2a2d35" strokeWidth={1} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#4a4f5e', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2d35' }}
            interval={0}
          />
          <YAxis
            tick={{ fill: '#4a4f5e', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
          />
          <ReferenceLine y={0} stroke="#2a2d35" />
          <Area
            dataKey="outer"
            stroke="none"
            fill="url(#mc-area)"
            fillOpacity={0.6}
            isAnimationActive={false}
            connectNulls
          />
          <Area
            dataKey="inner"
            stroke="none"
            fill="url(#mc-area)"
            isAnimationActive={false}
            connectNulls
          />
          <Line
            dataKey="hist"
            stroke="url(#mc-line)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            dataKey="median"
            stroke="url(#mc-line)"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
