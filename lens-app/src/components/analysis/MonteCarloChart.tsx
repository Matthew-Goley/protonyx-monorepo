import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { type ProjectionPoint } from '@/lib/lensData'

/** Monte Carlo projection fan: p10-p90 and p25-p75 bands plus a median line,
 *  with the historical lead-in line meeting at "Today". */
export function MonteCarloChart({
  points,
  medianColor,
}: {
  points: ProjectionPoint[]
  medianColor: string
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#4b5563', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1f2937' }}
            interval={0}
          />
          <YAxis
            tick={{ fill: '#4b5563', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
          />
          <ReferenceLine y={0} stroke="#1f2937" />
          <Area
            dataKey="outer"
            stroke="none"
            fill={medianColor}
            fillOpacity={0.1}
            isAnimationActive={false}
            connectNulls
          />
          <Area
            dataKey="inner"
            stroke="none"
            fill={medianColor}
            fillOpacity={0.22}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            dataKey="hist"
            stroke="#2dd4bf"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            dataKey="median"
            stroke={medianColor}
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
