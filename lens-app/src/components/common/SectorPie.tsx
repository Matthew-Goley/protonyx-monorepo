import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { PIE_COLORS, type SectorSlice } from '@/lib/lensData'

/** Donut pie + vertical legend, shared by the Diversification widget and the
 *  Analysis allocation-comparison pies. */
export function SectorPie({ slices, height = 200 }: { slices: SectorSlice[]; height?: number }) {
  if (slices.length === 0) {
    return <p className="text-sm text-muted">No sector data available.</p>
  }

  return (
    <div className="flex items-center gap-5">
      <div style={{ width: height, height }} className="shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-1 flex-col gap-2">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className="flex-1 text-secondary">{s.name}</span>
            <span className="font-medium text-primary">{s.value.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
