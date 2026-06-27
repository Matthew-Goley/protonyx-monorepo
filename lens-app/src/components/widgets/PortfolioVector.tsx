import { useEffect, useState } from 'react'
import { type LensResult } from '@/api/lens'
import { Panel } from '@/components/common/Panel'
import { portfolioSlopePct, formatPercent } from '@/lib/lensData'

/*
  Portfolio Vector - a glanceable "which way is the book heading" indicator,
  deliberately NOT a chart. The equity-weighted regression slope is classified
  into one of 5 ordered tiers and shown as a vertical Status Ladder (moon on top,
  crashing at the bottom). A glowing rail slides to the portfolio's current rung
  on load (the only motion), and hovering any rung previews what that level means,
  mirroring the interactive hover model of the pie charts.
*/

// ---------------------------------------------------------------------------
// Tier model - the single source of direction. index 0 = worst, 4 = best.
// ---------------------------------------------------------------------------

type TierKey = 'crash' | 'down' | 'flat' | 'up' | 'moon'

interface Tier {
  key: TierKey
  index: 0 | 1 | 2 | 3 | 4
  label: string
  color: string
  caption: string
}

// Red -> orange -> grey -> green -> teal. Semantic momentum spectrum (not the
// brand gradient), so a glance reads bad/flat/good intuitively.
const TIERS: Tier[] = [
  { key: 'crash', index: 0, label: 'Crashing', color: '#f16b6b', caption: 'Falling sharply, well below trend.' },
  { key: 'down', index: 1, label: 'Sliding', color: '#f5a623', caption: 'Drifting lower on an equity-weighted basis.' },
  { key: 'flat', index: 2, label: 'Flat', color: '#8b90a0', caption: 'Roughly flat, with no clear direction.' },
  { key: 'up', index: 3, label: 'Climbing', color: '#3ecf8e', caption: 'Trending up on an equity-weighted basis.' },
  { key: 'moon', index: 4, label: 'To the moon', color: '#14b8a6', caption: 'Accelerating higher, well above trend.' },
]

// Slope thresholds (annualized %). Tunable; the bands just have to be ordered.
function classifyTier(slope: number): Tier {
  if (slope >= 15) return TIERS[4]
  if (slope >= 4) return TIERS[3]
  if (slope > -4) return TIERS[2]
  if (slope > -15) return TIERS[1]
  return TIERS[0]
}

// Ladder geometry.
const ROW_H = 34
const RAIL_H = 22
const RAIL_INSET = (ROW_H - RAIL_H) / 2

// ---------------------------------------------------------------------------
// Status Ladder
// ---------------------------------------------------------------------------

function StatusLadder({ tier, slope }: { tier: Tier; slope: number }) {
  // Top -> bottom = best -> worst (moon first).
  const rungs = [...TIERS].reverse()
  const currentRow = rungs.findIndex((t) => t.key === tier.key)

  const [hovered, setHovered] = useState<TierKey | null>(null)
  // Mount flag drives the one-time rail slide + staggered row reveal.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // The caption tracks whatever the user is hovering, else the real tier.
  const focus = hovered ? TIERS.find((t) => t.key === hovered)! : tier

  return (
    <div>
      <div className="relative" style={{ height: rungs.length * ROW_H }} onMouseLeave={() => setHovered(null)}>
        {/* full-height track (the ladder shaft) */}
        <span className="absolute left-[1px] top-0 w-0.5 rounded-full bg-subtle" style={{ height: rungs.length * ROW_H }} />

        {/* glowing rail (the "elevator car") slides to the current rung on load */}
        <span
          className="absolute left-0 w-1 rounded-full"
          style={{
            height: RAIL_H,
            top: RAIL_INSET,
            backgroundColor: tier.color,
            boxShadow: `0 0 10px ${tier.color}cc`,
            transform: `translateY(${(mounted ? currentRow : 0) * ROW_H}px)`,
            opacity: mounted ? 1 : 0,
            transition: 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease-out',
          }}
        />

        {rungs.map((t, i) => {
          const isCurrent = t.key === tier.key
          const isHover = hovered === t.key
          const lit = isCurrent || isHover
          return (
            <div
              key={t.key}
              onMouseEnter={() => setHovered(t.key)}
              className="absolute left-0 right-0 flex items-center gap-3 rounded-md pl-5 pr-2"
              style={{
                top: i * ROW_H,
                height: ROW_H,
                backgroundColor: isHover ? `${t.color}1f` : isCurrent ? `${t.color}14` : 'transparent',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'none' : 'translateX(-6px)',
                transition: `opacity 300ms ease-out ${i * 55}ms, transform 300ms ease-out ${i * 55}ms, background-color 200ms ease-out`,
              }}
            >
              <span
                className="rounded-full transition-all duration-200 ease-out"
                style={{
                  width: lit ? 11 : 8,
                  height: lit ? 11 : 8,
                  backgroundColor: t.color,
                  opacity: lit ? 1 : 0.4,
                  boxShadow: lit ? `0 0 9px ${t.color}aa` : 'none',
                }}
              />
              <span
                className="text-sm transition-colors duration-200 ease-out"
                style={{
                  color: isHover ? '#ffffff' : isCurrent ? t.color : 'var(--color-secondary)',
                  fontWeight: lit ? 600 : 400,
                }}
              >
                {t.label}
              </span>
              {isCurrent && (
                <span
                  className="ml-auto text-base font-semibold tracking-[-0.02em]"
                  style={{ color: t.color }}
                >
                  {formatPercent(slope, 1)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* caption follows the hovered rung (preview) or the real tier */}
      <p className="mt-3 flex items-center gap-2 text-sm text-secondary">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200 ease-out"
          style={{ backgroundColor: focus.color }}
        />
        <span className="transition-colors duration-200 ease-out">{focus.caption}</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget shell
// ---------------------------------------------------------------------------

export function PortfolioVectorWidget({ result }: { result: LensResult }) {
  const slope = portfolioSlopePct(result)
  const tier = classifyTier(slope)

  return (
    <Panel>
      <h3 className="mb-4 text-xl font-semibold text-primary">Portfolio Vector</h3>
      <StatusLadder tier={tier} slope={slope} />
      <p className="mt-3 text-[11px] text-secondary">6-month linear regression · equity-weighted</p>
    </Panel>
  )
}
