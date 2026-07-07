import { type LensResult } from '@/api/lens'
import { usePositions } from '@/hooks/usePositions'
import { tokenizeBrief, type BriefKind } from '@/lib/lensData'

// Weight stays at 500 max for these emphasis tokens; styling.md reserves 600
// for meaningful numeric metrics, not descriptive words.
const KIND_CLASS: Record<BriefKind, string> = {
  plain: '',
  ticker: 'font-medium text-accent-teal',
  money: 'text-accent-teal',
  percent: 'text-accent-teal',
  action: 'font-medium text-accent-blue',
}

/** Renders a Lens brief with tickers / dollar amounts / percentages / action
 *  verbs colored. Tickers are drawn from held positions plus recommendations. */
export function BriefText({
  result,
  className,
}: {
  result: LensResult
  className?: string
}) {
  const { data: positions = [] } = usePositions()
  const heldTickers = positions.map((p) => p.ticker)
  const tickers = [...heldTickers, ...(result.recommended_tickers ?? [])]
  const segments = tokenizeBrief(result.brief, tickers)

  return (
    <p className={className ?? 'text-lg leading-[1.7] text-primary'}>
      {segments.map((seg, i) => (
        <span key={i} className={KIND_CLASS[seg.kind]}>
          {seg.text}
        </span>
      ))}
    </p>
  )
}
