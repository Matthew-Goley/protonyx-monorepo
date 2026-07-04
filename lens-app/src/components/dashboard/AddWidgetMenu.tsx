import { Plus } from 'lucide-react'

/*
  Add Widget popover, anchored under the header Plus button. Presentational: it
  lists every registry widget not currently in the layout (by title) and calls
  onAdd when one is picked. Styling matches the TopBar popovers (Panel surface,
  subtle border, backdrop blur, no gradient). Outside-click / positioning is
  owned by the anchor in the Dashboard header.
*/
export function AddWidgetMenu({
  available,
  onAdd,
}: {
  available: { id: string; title: string }[]
  onAdd: (id: string) => void
}) {
  return (
    <div
      role="menu"
      className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 rounded-xl border border-subtle bg-surface/90 p-2 shadow-lg shadow-black/40 backdrop-blur-md"
    >
      {available.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted">All widgets added</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {available.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                role="menuitem"
                onClick={() => onAdd(w.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-primary transition-colors duration-200 ease-out hover:bg-card"
              >
                <Plus size={14} className="text-secondary" />
                {w.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
