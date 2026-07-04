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
  /** Controlled current view index. Pair with onIndexChange to let the parent
   *  own the index (e.g. to show the active view's unit in a card header). */
  index?: number
  onIndexChange?: (index: number) => void
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
  index,
  onIndexChange,
}: CyclablePieChartProps) {
  const [internalIndex, setInternalIndex] = useState(0)
  const controlled = index != null && onIndexChange != null
  const current = controlled ? index : internalIndex

  if (views.length === 0) {
    return <p className="text-sm text-muted">No data available.</p>
  }

  const safeIndex = ((current % views.length) + views.length) % views.length
  const view = views[safeIndex]
  const pieSize = size ?? Math.round(height * 0.46)
  const pieInner = innerRadius ?? Math.round(height * 0.3)

  const step = (delta: number) => {
    const next = (safeIndex + delta + views.length) % views.length
    if (controlled) onIndexChange(next)
    else setInternalIndex(next)
  }

  return (
    <div className={className}>
      {/* `key` remounts the pie on each view change so it re-animates. The cycle
          control rides in the legend footer so it sits centered under the list,
          not under the whole widget, freeing the pie to take more space. */}
      <LensPieChart
        key={safeIndex}
        data={view.data}
        height={height}
        size={pieSize}
        innerRadius={pieInner}
        showLegend
        legendPosition={legendPosition}
        legendFooter={
          views.length > 1 ? (
            <CycleControl
              label={view.label}
              onPrev={() => step(-1)}
              onNext={() => step(1)}
              className="mt-4 border-t border-subtle pt-3"
            />
          ) : undefined
        }
      />
    </div>
  )
}
