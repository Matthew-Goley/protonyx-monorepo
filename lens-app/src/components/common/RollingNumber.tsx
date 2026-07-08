import { memo } from 'react'

// Odometer-style number: each digit sits in a 1em window over a vertical 0-9
// strip and slides up/down when it changes. Non-digit characters ($ , . % + -)
// render statically. Fast by design so a hover readout never feels laggy.
const ROLL_MS = 200
const ROLL_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

function Digit({ value }: { value: number }) {
  return (
    <span className="inline-block overflow-hidden" style={{ height: '1em', lineHeight: 1 }}>
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${value}em)`,
          transition: `transform ${ROLL_MS}ms ${ROLL_EASING}`,
        }}
      >
        {DIGITS.map((d) => (
          <span key={d} style={{ height: '1em', lineHeight: 1 }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  )
}

function StaticChar({ char }: { char: string }) {
  return (
    <span className="inline-block" style={{ height: '1em', lineHeight: 1 }}>
      {char === ' ' ? ' ' : char}
    </span>
  )
}

/**
 * Renders an already-formatted numeric string with per-digit roll animation.
 * Pass the formatted value (e.g. "$1,234.56", "+3.45%"); each 0-9 glyph animates
 * when it changes. `className` styles the whole number (size / weight / color).
 */
export const RollingNumber = memo(function RollingNumber({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return (
    <span className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex leading-none tabular-nums">
        {value.split('').map((ch, i) =>
          ch >= '0' && ch <= '9' ? (
            <Digit key={i} value={Number(ch)} />
          ) : (
            <StaticChar key={i} char={ch} />
          ),
        )}
      </span>
    </span>
  )
})
