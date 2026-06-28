import { useState } from 'react'
import { Plus, SlidersHorizontal, Pencil, Trash2, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AddPositionModal } from '@/components/common/AddPositionModal'
import { formatCurrency } from '@/lib/lensData'
import { type PositionsManager } from '@/hooks/usePositionsManager'

/*
  Compact vertical action box for the dashboard, sitting to the left of the Lens
  Brief: a big + (add a position, opens AddPositionModal) and a Manage button
  (opens a slide-over drawer for editing/deleting holdings). No labels — just the
  two controls.
*/

// Inline shares editor (number field + confirm/cancel), used inside the drawer.
function SharesEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: number
  onSave: (n: number) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(String(initial))
  function save() {
    const n = Number(val)
    if (Number.isFinite(n) && n > 0) onSave(n)
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        value={val}
        autoFocus
        min="0"
        step="any"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onCancel()
        }}
        className="h-8 w-24"
      />
      <Button size="icon" variant="teal" className="h-8 w-8" onClick={save} aria-label="Save">
        <Check size={15} />
      </Button>
      <Button size="icon" variant="outline" className="h-8 w-8" onClick={onCancel} aria-label="Cancel">
        <X size={15} />
      </Button>
    </div>
  )
}

export function PositionActions({
  positions,
  addPosition,
  removePosition,
  updateShares,
  size,
}: PositionsManager & { size: number }) {
  const [addOpen, setAddOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  // Square side for each of the two stacked buttons: the container height (`size`)
  // minus the p-4 padding (16 top + 16 bottom) and the gap-4 between them (16),
  // split in half. Keep 48 in sync with the p-4 / gap-4 classes below.
  const buttonSide = (size - 48) / 2

  return (
    <>
      {/* Two square buttons stacked → the container is a 1x2 (tall) rectangle.
          Container height = `size` (matches the Lens Brief). */}
      <div
        style={{ height: size }}
        className="flex shrink-0 flex-col items-center gap-4 self-start rounded-lg border border-subtle bg-card p-4"
      >
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Add position"
          title="Add position"
          style={{ width: buttonSide, height: buttonSide }}
          className="bg-gradient-brand flex items-center justify-center rounded-xl text-[#0a0d12] transition-transform duration-200 ease-out hover:scale-[1.03]"
        >
          <Plus size={32} />
        </button>
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Manage holdings"
          title="Manage holdings"
          style={{ width: buttonSide, height: buttonSide }}
          className="flex items-center justify-center rounded-xl border border-subtle text-secondary transition-colors duration-200 ease-out hover:border-[#3a3f4e] hover:bg-card-hover hover:text-primary"
        >
          <SlidersHorizontal size={28} />
        </button>
      </div>

      {addOpen && (
        <AddPositionModal onClose={() => setAddOpen(false)} onAdd={(p) => { addPosition(p); setAddOpen(false) }} />
      )}

      {drawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60"
          onClick={() => { setDrawer(false); setEditing(null) }}
        >
          <div
            className="h-full w-full max-w-sm overflow-y-auto border-l border-subtle bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-primary">Manage holdings</h2>
              <button onClick={() => { setDrawer(false); setEditing(null) }} className="text-secondary hover:text-primary" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="divide-y divide-subtle">
              {positions.map((p) => (
                <div key={p.ticker} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-primary">{p.ticker}</p>
                    <p className="truncate text-xs text-secondary">{p.shares} sh · {formatCurrency(p.price)}</p>
                  </div>
                  {editing === p.ticker ? (
                    <SharesEditor
                      initial={p.shares}
                      onSave={(n) => { updateShares(p.ticker, n); setEditing(null) }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setEditing(p.ticker)} aria-label="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="red" className="h-8 w-8" onClick={() => removePosition(p.ticker)} aria-label="Delete">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {positions.length === 0 && <p className="py-6 text-center text-sm text-secondary">No holdings yet.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
