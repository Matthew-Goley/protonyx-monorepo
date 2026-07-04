import { useEffect, useState } from 'react'
import { cautionClass } from '@/lib/lensData'

/**
 * Caution Score centerpiece (styling.md §Caution Score Component).
 * The semicircular gauge arc always uses the brand gradient as its stroke; the
 * score value is gradient-filled. Tier color is applied only to the
 * supplementary label below. The arc sweeps 0 -> value once on load (600ms).
 *
 * `size` scales the whole gauge so the Analysis page ('lg', default) and the
 * compact Dashboard widget ('sm') share one implementation and never diverge.
 * Pass an empty `caption` to suppress the sub-label (the widget renders its own
 * beginner-facing sentence instead).
 */
type GaugeSize = 'sm' | 'lg'

interface GaugeGeometry {
  w: number
  h: number
  r: number
  sw: number
  cx: number
  cy: number
  font: number
}

const GEOMETRY: Record<GaugeSize, GaugeGeometry> = {
  lg: { w: 260, h: 150, r: 100, sw: 18, cx: 130, cy: 130, font: 56 },
  // sm is used only by the Caution Score dashboard widget; sized up to fill its 3x3 tile.
  sm: { w: 224, h: 132, r: 88, sw: 16, cx: 112, cy: 112, font: 52 },
}

export function CautionGauge({
  score,
  size = 'lg',
  caption = 'Based on current portfolio state',
}: {
  score: number
  size?: GaugeSize
  caption?: string
}) {
  const cls = cautionClass(score)
  const clamped = Math.max(0, Math.min(100, score))
  const g = GEOMETRY[size]

  // Animate the arc from 0 to the value on mount only.
  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(clamped))
    return () => cancelAnimationFrame(id)
  }, [clamped])

  const point = (value: number) => {
    const angle = Math.PI - (value / 100) * Math.PI
    return { x: g.cx + g.r * Math.cos(angle), y: g.cy - g.r * Math.sin(angle) }
  }

  const start = point(0)
  const end = point(100)
  const trackPath = `M ${start.x} ${start.y} A ${g.r} ${g.r} 0 1 1 ${end.x} ${end.y}`
  // Half-circumference is the drawable length; dash it by the animated fraction.
  const arcLen = Math.PI * g.r
  const dash = (animated / 100) * arcLen

  return (
    <div className="caution-score-wrapper flex flex-col items-center justify-center">
      <svg width={g.w} height={g.h} viewBox={`0 0 ${g.w} ${g.h}`}>
        <defs>
          {/* Brand gradient #38bdf8 -> #60a5fa (styling.md). */}
          <linearGradient id="caution-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <path
          d={trackPath}
          fill="none"
          stroke="var(--color-subtle)"
          strokeWidth={g.sw}
          strokeLinecap="round"
        />
        <path
          className="caution-arc"
          d={trackPath}
          fill="none"
          stroke="url(#caution-grad)"
          strokeWidth={g.sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`}
        />
        <text
          x={g.cx}
          y={g.cy - 2}
          textAnchor="middle"
          fontSize={g.font}
          fontWeight="600"
          letterSpacing="-0.02em"
          fill="url(#caution-grad)"
        >
          {clamped}
        </text>
      </svg>
      <p
        style={{ color: cls.color }}
        className={`-mt-1 font-medium ${size === 'sm' ? 'text-base' : 'text-sm'}`}
      >
        {cls.label}
      </p>
      {caption ? (
        <p className="caution-score-label mt-1 text-[13px] font-medium uppercase tracking-[0.08em] text-secondary">
          {caption}
        </p>
      ) : null}
    </div>
  )
}
