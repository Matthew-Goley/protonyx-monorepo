import { useEffect, useState } from 'react'
import { cautionClass } from '@/lib/lensData'

/**
 * Caution Score centerpiece (styling.md §Caution Score Component).
 * The semicircular gauge arc always uses the brand gradient as its stroke; the
 * 56px score value is gradient-filled. Tier color is applied only to the
 * supplementary label below. The arc sweeps 0 -> value once on load (600ms).
 */
export function CautionGauge({ score }: { score: number }) {
  const cls = cautionClass(score)
  const clamped = Math.max(0, Math.min(100, score))

  // Animate the arc from 0 to the value on mount only.
  const [animated, setAnimated] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(clamped))
    return () => cancelAnimationFrame(id)
  }, [clamped])

  const cx = 130
  const cy = 130
  const r = 100

  const point = (value: number) => {
    const angle = Math.PI - (value / 100) * Math.PI
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) }
  }

  const start = point(0)
  const end = point(100)
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`
  // Half-circumference is the drawable length; dash it by the animated fraction.
  const arcLen = Math.PI * r
  const dash = (animated / 100) * arcLen

  return (
    <div className="caution-score-wrapper flex flex-col items-center justify-center">
      <svg width={260} height={150} viewBox="0 0 260 150">
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
          strokeWidth={18}
          strokeLinecap="round"
        />
        <path
          className="caution-arc"
          d={trackPath}
          fill="none"
          stroke="url(#caution-grad)"
          strokeWidth={18}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`}
        />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="56"
          fontWeight="600"
          letterSpacing="-0.02em"
          fill="url(#caution-grad)"
        >
          {clamped}
        </text>
      </svg>
      <p style={{ color: cls.color }} className="-mt-1 text-sm font-medium">
        {cls.label}
      </p>
      <p className="caution-score-label mt-1 text-[13px] font-medium uppercase tracking-[0.08em] text-secondary">
        Based on current portfolio state
      </p>
    </div>
  )
}
