import { cautionClass } from '@/lib/lensData'

/** Semicircular caution gauge rendered as SVG (0 left to 100 right). */
export function CautionGauge({ score }: { score: number }) {
  const cls = cautionClass(score)
  const clamped = Math.max(0, Math.min(100, score))

  const cx = 130
  const cy = 130
  const r = 100
  const stroke = 18

  // Point on the semicircle for a 0..100 value (180deg sweep, left to right).
  const point = (value: number) => {
    const angle = Math.PI - (value / 100) * Math.PI
    return {
      x: cx + r * Math.cos(angle),
      y: cy - r * Math.sin(angle),
    }
  }

  const start = point(0)
  const end = point(100)
  const valueEnd = point(clamped)
  const largeArc = clamped > 50 ? 1 : 0

  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`
  const valuePath = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${valueEnd.x} ${valueEnd.y}`

  return (
    <div className="flex flex-col items-center">
      <svg width={260} height={150} viewBox="0 0 260 150">
        <path
          d={trackPath}
          fill="none"
          stroke="#0a0d14"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={valuePath}
          fill="none"
          stroke={cls.color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize="48"
          fontWeight="700"
          fill={cls.color}
        >
          {clamped}
        </text>
      </svg>
      <p style={{ color: cls.color }} className="-mt-2 text-lg font-semibold">
        {cls.label}
      </p>
      <p className="mt-1 text-xs text-muted">Based on current portfolio state</p>
    </div>
  )
}
