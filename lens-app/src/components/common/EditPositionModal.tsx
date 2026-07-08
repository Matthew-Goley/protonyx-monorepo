import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { type Position } from '@/api/lens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** Edits an existing holding's share count. The ticker is fixed (shown read-only);
 *  only the share count changes. Equity is recomputed server-side from the stored
 *  price by the PATCH /positions/:ticker route (via usePositionsManager.updateShares). */
export function EditPositionModal({
  position,
  onClose,
  onSave,
}: {
  position: Position
  onClose: () => void
  onSave: (ticker: string, shares: number) => void | Promise<void>
}) {
  const [shares, setShares] = useState(String(position.shares))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Esc closes the modal (app-wide), unless a save is in flight.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saving, onClose])

  function onFieldKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !saving) {
      e.preventDefault()
      handleSave()
    }
  }

  async function handleSave() {
    setError(null)
    const shareCount = Number(shares)
    if (!Number.isFinite(shareCount) || shareCount <= 0) {
      setError('Enter a valid number of shares.')
      return
    }
    if (shareCount === position.shares) {
      onClose()
      return
    }

    setSaving(true)
    try {
      await onSave(position.ticker, shareCount)
      onClose()
    } catch {
      setError('Could not save changes, try again.')
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-subtle bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-primary">Edit Holding</h2>
        <p className="mt-1 text-sm text-secondary">
          Update the share count for {position.name ?? position.ticker}.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium uppercase tracking-wider text-secondary">
              Ticker Symbol
            </label>
            <Input value={position.ticker} readOnly disabled />
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
              autoFocus
              disabled={saving}
            />
          </div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-sm text-secondary transition-all duration-200 ease-out hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <Button variant="gradient" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
