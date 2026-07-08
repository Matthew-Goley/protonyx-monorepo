import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cautionClass, tokenizeBrief } from '@/lib/lensData'
import { type LensHistoryEntry } from '@/lib/lensHistory'

// Same color roles as BriefText, minus tickers (history stores only the brief
// string, not the positions needed to detect held tickers, so money / percent /
// action words still color but bare tickers render plain).
const KIND_CLASS: Record<string, string> = {
  plain: '',
  ticker: '',
  money: 'text-accent-teal',
  percent: 'text-accent-teal',
  action: 'font-medium text-accent-blue',
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Blocking-ish overlay listing past Lens readings (caution score + brief),
 *  newest first. Backdrop click and Esc close it. Portaled to document.body so
 *  `fixed` resolves against the viewport, not any transformed ancestor. */
export function HistoryModal({
  entries,
  onClose,
  onClear,
}: {
  entries: LensHistoryEntry[]
  onClose: () => void
  onClear: () => void
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-subtle bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-subtle p-6">
          <div>
            <h2 className="text-xl font-semibold text-primary">Analysis History</h2>
            <p className="mt-1 text-sm text-secondary">Your recent Lens readings, newest first.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-secondary transition-colors duration-200 ease-out hover:bg-card-hover hover:text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-muted">
              No history yet. Your readings are recorded as you view the Analysis page.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-6">
            {entries.map((entry) => {
              const band = cautionClass(entry.caution_score)
              const segments = tokenizeBrief(entry.brief, [])
              return (
                <div
                  key={entry.timestamp}
                  className="rounded-md border border-subtle p-4 transition-colors duration-200 ease-out hover:bg-card-hover"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-secondary">{formatWhen(entry.timestamp)}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-base font-semibold" style={{ color: band.color }}>
                        {entry.caution_score}
                      </span>
                      <span
                        className="text-[11px] uppercase tracking-wider"
                        style={{ color: band.color }}
                      >
                        {band.label}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-[1.6] text-primary">
                    {segments.map((seg, i) => (
                      <span key={i} className={KIND_CLASS[seg.kind]}>
                        {seg.text}
                      </span>
                    ))}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {entries.length > 0 && (
          <div className="flex justify-end border-t border-subtle p-4">
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-secondary transition-colors duration-200 ease-out hover:text-accent-red"
            >
              Clear history
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
