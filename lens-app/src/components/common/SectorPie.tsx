import { LensPieChart, PIE_COLORS } from '@/components/charts'
import { type SectorSlice } from '@/lib/lensData'

/** Donut pie + vertical legend, shared by the Diversification widget and the
 *  Analysis allocation-comparison pies. Thin wrapper over the chart layer's
 *  LensPieChart; assigns colors from the brand PIE_COLORS palette. */
export function SectorPie({ slices, height = 200 }: { slices: SectorSlice[]; height?: number }) {
  if (slices.length === 0) {
    return <p className="text-sm text-muted">No sector data available.</p>
  }

  const data = slices.map((s, i) => ({
    name: s.name,
    value: s.value,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <LensPieChart
      data={data}
      height={height}
      size={Math.round(height * 0.4)}
      innerRadius={Math.round(height * 0.26)}
      showLegend
      legendPosition="right"
    />
  )
}
