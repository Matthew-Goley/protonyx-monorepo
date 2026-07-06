import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { lensApi, type Position } from '@/api/lens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Validates the ticker against lens-api (GET /ticker/{symbol}/info) before
 *  building the Position, pulling live price / sector / name from the response. */
export function AddPositionModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (position: Position) => void
}) {
  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Esc closes the modal (app-wide), unless a validation is in flight.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !validating) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [validating, onClose])

  function onFieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !validating) {
      e.preventDefault()
      handleAdd()
    }
  }

  async function handleAdd() {
    setError(null)
    const sym = ticker.trim().toUpperCase()
    const shareCount = Number(shares)
    if (!sym) {
      setError('Enter a ticker symbol.')
      return
    }
    if (!Number.isFinite(shareCount) || shareCount <= 0) {
      setError('Enter a valid number of shares.')
      return
    }

    setValidating(true)
    try {
      const info = await lensApi.getTickerInfo(sym)
      const price = info.current_price ?? 0
      const position: Position = {
        ticker: sym,
        shares: shareCount,
        price,
        equity: price * shareCount,
        sector: info.sector ?? 'Unknown',
        name: info.name ?? sym,
        added_at: new Date().toISOString(),
      }
      onAdd(position)
    } catch {
      setError('Ticker not found, check the symbol.')
    } finally {
      setValidating(false)
    }
  }

  // Portaled to document.body so `fixed` positioning resolves against the
  // viewport, not a transformed ancestor (dashboard widgets render inside a
  // FitScale transform, which would otherwise trap this inside the widget box).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-subtle bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-primary">Add a Position</h2>
        <p className="mt-1 text-sm text-secondary">
          Lens validates the ticker before saving.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium uppercase tracking-wider text-secondary">
              Ticker Symbol
            </label>
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={onFieldKeyDown}
              placeholder="AAPL"
              autoFocus
              disabled={validating}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium uppercase tracking-wider text-secondary">
              Number of Shares
            </label>
            <Input
              type="number"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              onKeyDown={onFieldKeyDown}
              placeholder="10"
              min="0"
              step="any"
              disabled={validating}
            />
          </div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={validating}
            className="text-sm text-secondary transition-all duration-200 ease-out hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <Button variant="gradient" onClick={handleAdd} disabled={validating}>
            {validating && <Loader2 size={16} className="animate-spin" />}
            {validating ? 'Validating...' : 'Validate & Add'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
