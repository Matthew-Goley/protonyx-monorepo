import { useState } from 'react'
import { LensPieChart, type PieSlice } from './LensPieChart'
import { CycleControl } from '@/components/common/CycleControl'

export interface PieView {
  /** Short label shown in the cycle control, e.g. "By Sector". */
  label: string
  data: PieSlice[]
}

export interface CyclablePieChartProps {
  /** One entry per breakdown the user can cycle through. */
  views: PieView[]
  /** Pie outer radius in px. Defaults to 0.46 x height. */
  size?: number
  /** Pie inner radius in px. Defaults to 0.3 x height. */
  innerRadius?: number
  height?: number
  legendPosition?: 'right' | 'bottom'
  className?: string
}

/**
 * A donut pie that cycles through multiple labeled breakdowns of the same total
 * (e.g. by sector / by ticker / by type). Two rounded triangle arrows step
 * through the views with wrap-around, and the pie re-runs its load animation on
 * each switch. Reusable anywhere a single dataset has several groupings.
 */
export function CyclablePieChart({
  views,
  size,
  innerRadius,
  height = 200,
  legendPosition = 'right',
  className,
}: CyclablePieChartProps) {
  const [index, setIndex] = useState(0)

  if (views.length === 0) {
    return <p className="text-sm text-muted">No data available.</p>
  }

  const safeIndex = index % views.length
  const view = views[safeIndex]
  const pieSize = size ?? Math.round(height * 0.46)
  const pieInner = innerRadius ?? Math.round(height * 0.3)

  const step = (delta: number) => setIndex((i) => (i + delta + views.length) % views.length)

  return (
    <div className={className}>
      {/* `key` remounts the pie on each view change so it re-animates. */}
      <LensPieChart
        key={safeIndex}
        data={view.data}
        height={height}
        size={pieSize}
        innerRadius={pieInner}
        showLegend
        legendPosition={legendPosition}
      />

      {views.length > 1 && (
        <CycleControl
          label={view.label}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          className="mt-4 border-t border-subtle pt-3"
        />
      )}
    </div>
  )
}
