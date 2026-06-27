import { LensAreaFanChart, CHART_COLORS } from '@/components/charts'
import { type ProjectionPoint } from '@/lib/lensData'

/**
 * Monte Carlo projection fan (styling.md §Charts): brand-gradient median line +
 * shaded p10/p90 and p25/p75 bands, horizontal grid lines only, transparent
 * background, 11px tertiary axis labels, a "Today" marker between the historical
 * lead-in and the projection. Thin wrapper over the chart layer's
 * LensAreaFanChart; flattens the tuple bands into discrete keys it expects.
 */
export function MonteCarloChart({ points }: { points: ProjectionPoint[] }) {
  const data = points.map((p) => ({
    label: p.label,
    hist: p.hist,
    median: p.median,
    outerLow: p.outer ? p.outer[0] : null,
    outerHigh: p.outer ? p.outer[1] : null,
    innerLow: p.inner ? p.inner[0] : null,
    innerHigh: p.inner ? p.inner[1] : null,
  }))
  const todayIndex = points.findIndex((p) => p.label === 'Today')

  // Fit the Y domain to every band/line value (recharts' default [0, 'auto']
  // would clip the negative loss bands and squash the fan flat). Always span 0
  // so the "Today" baseline reads, then pad ~10% so the outer band has air.
  const ys: number[] = []
  for (const p of points) {
    if (p.hist != null) ys.push(p.hist)
    if (p.median != null) ys.push(p.median)
    if (p.outer) ys.push(p.outer[0], p.outer[1])
    if (p.inner) ys.push(p.inner[0], p.inner[1])
  }
  const lo = Math.min(0, ...ys)
  const hi = Math.max(0, ...ys)
  const pad = Math.max(1, (hi - lo) * 0.1)
  const yDomain: [number, number] = [Math.floor(lo - pad), Math.ceil(hi + pad)]

  return (
    <LensAreaFanChart
      data={data}
      xKey="label"
      bands={[
        { upperKey: 'outerHigh', lowerKey: 'outerLow', color: CHART_COLORS.blue, opacity: 0.1 },
        { upperKey: 'innerHigh', lowerKey: 'innerLow', color: CHART_COLORS.blue, opacity: 0.18 },
      ]}
      medianKey="median"
      historicalKey="hist"
      todayIndex={todayIndex >= 0 ? todayIndex : undefined}
      color="url(#lens-brand-line)"
      height={220}
      yDomain={yDomain}
      yTickFormatter={(v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`}
      valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
    />
  )
}
