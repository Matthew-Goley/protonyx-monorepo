import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
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
  /** Human-readable slope band shown on the info hover. */
  range: string
}

// Slope band boundaries (annualized %). Single source for both classifyTier and
// the displayed ranges below, so they can never drift. Tunable.
const T_UP = 4
const T_MOON = 15

// Red -> orange -> grey -> green -> teal. Semantic momentum spectrum (not the
// brand gradient), so a glance reads bad/flat/good intuitively.
const TIERS: Tier[] = [
  { key: 'crash', index: 0, label: 'Falling', color: '#f16b6b', caption: 'Falling sharply on an equity-weighted basis.', range: `≤ -${T_MOON}%` },
  { key: 'down', index: 1, label: 'Slipping', color: '#f5a623', caption: 'Drifting lower on an equity-weighted basis.', range: `-${T_MOON}% to -${T_UP}%` },
  { key: 'flat', index: 2, label: 'Flat', color: '#8b90a0', caption: 'Roughly flat, with no clear direction.', range: `-${T_UP}% to +${T_UP}%` },
  { key: 'up', index: 3, label: 'Rising', color: '#3ecf8e', caption: 'Moving higher on an equity-weighted basis.', range: `+${T_UP}% to +${T_MOON}%` },
  { key: 'moon', index: 4, label: 'Surging', color: '#14b8a6', caption: 'Accelerating sharply higher on an equity-weighted basis.', range: `≥ +${T_MOON}%` },
]

function classifyTier(slope: number): Tier {
  if (slope >= T_MOON) return TIERS[4]
  if (slope >= T_UP) return TIERS[3]
  if (slope > -T_UP) return TIERS[2]
  if (slope > -T_MOON) return TIERS[1]
  return TIERS[0]
}

// Ladder geometry.
const ROW_H = 34
const RAIL_H = 22
const RAIL_INSET = (ROW_H - RAIL_H) / 2

// ---------------------------------------------------------------------------
// Status Ladder
// ---------------------------------------------------------------------------

function StatusLadder({
  tier,
  slope,
  showThresholds,
}: {
  tier: Tier
  slope: number
  showThresholds: boolean
}) {
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
              {showThresholds ? (
                <span className="ml-auto text-xs tabular-nums text-secondary">{t.range}</span>
              ) : isCurrent ? (
                <span
                  className="ml-auto text-base font-semibold tracking-[-0.02em]"
                  style={{ color: t.color }}
                >
                  {formatPercent(slope, 1)}
                </span>
              ) : null}
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
  // Hovering the info icon reveals each rank's slope threshold on the ladder.
  const [showThresholds, setShowThresholds] = useState(false)

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-primary">Portfolio Momentum</h3>
        <button
          type="button"
          aria-label="Show momentum thresholds"
          onMouseEnter={() => setShowThresholds(true)}
          onMouseLeave={() => setShowThresholds(false)}
          onFocus={() => setShowThresholds(true)}
          onBlur={() => setShowThresholds(false)}
          className="text-secondary transition-colors duration-200 ease-out hover:text-primary"
        >
          <Info size={16} />
        </button>
      </div>
      <StatusLadder tier={tier} slope={slope} showThresholds={showThresholds} />
      <p className="mt-3 text-[11px] text-secondary">6-month linear regression · equity-weighted</p>
    </Panel>
  )
}
