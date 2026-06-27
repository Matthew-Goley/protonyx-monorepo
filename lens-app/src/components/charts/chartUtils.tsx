import { useEffect, useRef } from 'react'

/*
  Shared internals for the Lens chart wrapper layer. This directory is the only
  place in the app that may import from `recharts`; everything else renders
  charts through the wrappers in `./index`. All design values below come from
  styling.md §Charts (see lens-app/CLAUDE.md §6) and must not drift.
*/

// Brand + semantic chart colors. recharts stroke/fill/stopColor props take
// literal hex (the one place hardcoded color is allowed, per CLAUDE.md §6).
export const CHART_COLORS = {
  teal: '#14b8a6',
  blue: '#38bdf8',
  green: '#3ecf8e',
  red: '#f16b6b',
  yellow: '#f5a623',
  subtle: '#2a2d35',
  muted: '#4a4f5e',
  secondary: '#8b90a0',
} as const

// Pie palette: brand teal/sky/gain, then cool slate shades. No purple
// (styling.md hard rule). Canonical home — re-exported from `@/lib/lensData`.
export const PIE_COLORS = [
  '#14b8a6', // brand teal
  '#38bdf8', // brand sky
  '#3ecf8e', // gain green
  '#8b90a0', // text-secondary slate
  '#5b6473', // mid slate
  '#0e8c80', // deep teal
  '#2f7fb0', // deep sky
  '#3a3f4e', // dark slate
]

// Spread onto <XAxis>/<YAxis> `tick`. 11px tertiary axis labels (styling.md).
export const AXIS_TICK_PROPS = {
  fontSize: 11,
  fill: CHART_COLORS.muted,
  fontFamily: 'inherit',
} as const

// Spread onto <CartesianGrid>. Horizontal lines only, subtle dashed, no bg.
export const GRID_PROPS = {
  vertical: false,
  stroke: CHART_COLORS.subtle,
  strokeDasharray: '3 3',
} as const

// Brand gradient SVG defs. Render once inside a recharts chart as a child:
// the horizontal `lens-brand-line` (135deg teal -> sky) for line/area strokes,
// and the vertical `lens-brand-area` for area fills.
export function GradientDefs() {
  return (
    <defs>
      <linearGradient id="lens-brand-line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={CHART_COLORS.teal} />
        <stop offset="100%" stopColor={CHART_COLORS.blue} />
      </linearGradient>
      <linearGradient id="lens-brand-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.18} />
        <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  )
}

// Standard tooltip box (replaces recharts' default styling). Passed to a chart
// as `content={<LensTooltip formatter={...} />}`; recharts injects the rest.
interface TooltipPayloadItem {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}
interface LensTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  formatter?: (value: number | string, name: string) => React.ReactNode
}
export function LensTooltip({ active, payload, label, formatter }: LensTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-subtle bg-card px-3 py-2 text-sm text-primary shadow-lg">
      {label !== undefined && label !== '' && (
        <p className="mb-1 text-xs text-secondary">{label}</p>
      )}
      {payload.map((item, i) => {
        const value = item.value ?? ''
        const name = item.name ?? String(item.dataKey ?? '')
        return (
          <div key={i} className="flex items-center gap-2">
            {item.color && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
            <span className="text-primary">{formatter ? formatter(value, name) : value}</span>
          </div>
        )
      })}
    </div>
  )
}

/*
  Animate on first mount only. recharts re-runs its entry animation on every
  data change, which causes a distracting re-animation when the analysis cache
  refetches. This returns true on the first render and false thereafter, so a
  chart animates once (400ms ease-out) and stays static on data updates.
*/
export function useAnimateOnce(): boolean {
  const first = useRef(true)
  useEffect(() => {
    first.current = false
  }, [])
  return first.current
}

// Shared animation props for any recharts series (Line/Area/Pie).
export const ANIM_DURATION = 400
export const ANIM_EASING = 'ease-out' as const
