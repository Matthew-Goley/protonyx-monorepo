import { type LensResult } from '@/api/lens'
import { ctaAccent, ctaActionLabel, formatCurrency } from '@/lib/lensData'

/** Renders each CTA as a left-bordered card with an action badge and the
 *  matching full_report sentence as the explanation (zipped by index). */
export function CtaList({ result }: { result: LensResult }) {
  const ctas = result.ctas ?? []
  const report = result.full_report as string[] | undefined

  if (ctas.length === 0) {
    return <p className="text-sm text-muted">No projections, the portfolio is holding steady.</p>
  }

  return (
    <div className="space-y-3">
      {ctas.map((cta, i) => {
        const accent = ctaAccent(cta.action)
        const label = ctaActionLabel(cta.action)
        const isSell = cta.action === 'sell' || cta.action === 'rebalance'
        const isBuy = cta.action === 'buy_new' || cta.action === 'buy_more'
        const amount =
          cta.dollars > 0
            ? `${isSell ? '-' : isBuy ? '+' : ''}${formatCurrency(cta.dollars, 0)}`
            : ''
        const explanation =
          (report && report[i]) ||
          `${cta.ticker} · ${cta.reason.replace(/_/g, ' ')}`

        return (
          <div
            key={i}
            className="rounded-lg bg-base p-4"
            style={{ borderLeft: `3px solid ${accent}` }}
          >
            <span className="text-[13px] font-semibold" style={{ color: accent }}>
              {label}
              {amount && ` ${amount}`}
              {cta.ticker && ` · ${cta.ticker}`}
            </span>
            <p className="mt-1.5 text-sm leading-relaxed text-secondary">{explanation}</p>
          </div>
        )
      })}
    </div>
  )
}
