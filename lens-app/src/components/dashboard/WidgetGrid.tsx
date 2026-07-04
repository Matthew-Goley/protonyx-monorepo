import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { X } from 'lucide-react'
import { type LensResult } from '@/api/lens'
import {
  GRID_COLUMNS,
  GRID_GAP,
  fitSpan,
  placeNew,
  placeWidgets,
  removeWidget,
  tryMoveElement,
  widgetPxWidth,
  type LayoutItem,
} from '@/lib/widgetLayout'
import { WIDGET_REGISTRY, getWidget } from '@/lib/widgetRegistry'
import { getLayout as readSavedLayout, setLayout as writeSavedLayout, clearLayout } from '@/lib/cookies'
import { useGridMetrics } from '@/hooks/useGridMetrics'
import { useDashboardEdit } from '@/contexts/DashboardEditContext'
import { cn } from '@/lib/utils'

/*
  Data-driven dashboard widget grid with an opt-in edit mode layered on top of
  the existing measure-then-place system.

  BASE (edit mode OFF, the default every load): pixel-identical to before. A
  two-pass render measures each widget's real height and packs square cells;
  h is ALWAYS measured, never trusted from persistence. The lens_layout cookie
  is authoritative for PLACEMENT (x, y, w) only - on load a saved layout is
  rebuilt with freshly measured h at its exact saved position; if there is no
  saved layout the default first-fit pack runs (unchanged behavior).

  EDIT MODE (opt-in via the header Pencil): each card becomes a whole-card drag
  handle (native Pointer Events, no dependency), plus a remove (X) control;
  widgets can be added from the header Add menu. Placement is MANUAL and
  NON-DISPLACING - no widget ever moves to make room for another. A drag only
  commits when the destination is open (tryMoveElement); dropping over another
  widget snaps back. Add drops into the first free slot; delete leaves a gap.
  Every mutation commits to state and persists {x, y, w} to the cookie. No
  resize this phase (w stays the registry value). All affordances exist ONLY in
  edit mode; a user who never enables it sees zero change.
*/

const DRAG_THRESHOLD = 4 // px of movement before a pointerdown counts as a drag

// Static dim placeholder shown for the frame before the cell size is measured
// and the first layout is computed (styling.md §Motion: no pulse).
function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-56 rounded-lg bg-card opacity-60" />
      ))}
    </div>
  )
}

export function WidgetGrid({ result }: { result: LensResult }) {
  const { ref, cellSize } = useGridMetrics()
  const { editMode, setGridActions } = useDashboardEdit()

  const gridRef = useRef<HTMLDivElement | null>(null)
  const measureRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const measuredRef = useRef<Record<string, number>>({}) // widget id -> measured px
  const [layout, setLayoutState] = useState<LayoutItem[] | null>(null)

  // Drag transients. dragStartRef holds pointerdown state (no re-render); `drag`
  // holds the live preview + translate that drives the render during a drag.
  const dragStartRef = useRef<{
    id: string
    snapshot: LayoutItem[]
    px: number
    py: number
    gx: number
    gy: number
    sx: number
    sy: number
    moved: boolean
  } | null>(null)
  // `valid` is whether the current drop target is open; `next` is the layout to
  // commit on release (null when the target overlaps another widget -> snap back).
  const [drag, setDrag] = useState<{
    id: string
    tx: number
    ty: number
    valid: boolean
    next: LayoutItem[] | null
  } | null>(null)

  // Measured row span for a widget: floor vs. its measured pixel height. A
  // lockHeight widget ignores measurement and uses its defaultSpan.h verbatim, so
  // it never grows a row regardless of content (it handles its own overflow).
  const measuredH = useCallback(
    (id: string): number => {
      const entry = getWidget(id)
      if (!entry) return 0
      if (entry.lockHeight) return entry.defaultSpan.h
      return fitSpan(entry.defaultSpan.h, measuredRef.current[id] ?? 0, cellSize, GRID_GAP)
    },
    [cellSize],
  )

  // Build the layout from the saved placement (exact x/y/w + fresh measured h)
  // or, absent a save, the default first-fit pack. No compaction: a saved
  // arrangement is restored precisely where the user left it.
  const buildLayout = useCallback((): LayoutItem[] => {
    const saved = readSavedLayout()
    if (saved) {
      return saved
        .filter((s) => getWidget(s.widgetId))
        .map((s) => ({
          widgetId: s.widgetId,
          x: s.x,
          y: s.y,
          w: getWidget(s.widgetId)!.defaultSpan.w, // width is always the registry value
          h: measuredH(s.widgetId),
        }))
    }
    const footprints = WIDGET_REGISTRY.filter((w) => w.defaultVisible).map((w) => ({
      widgetId: w.id,
      w: w.defaultSpan.w,
      h: measuredH(w.id),
    }))
    return placeWidgets(footprints, GRID_COLUMNS)
  }, [measuredH])

  // PASS 1 measure + build. useLayoutEffect so the layout commits before paint;
  // re-runs on resize (cell height changes h) or content change (heights change).
  useLayoutEffect(() => {
    if (cellSize <= 0) return
    const map: Record<string, number> = {}
    for (const w of WIDGET_REGISTRY) {
      const el = measureRefs.current.get(w.id)
      map[w.id] = el ? el.getBoundingClientRect().height : 0
    }
    measuredRef.current = map
    const hadSaved = readSavedLayout() !== null
    const built = buildLayout()
    setLayoutState(built)
    // Persist the freshly computed default so the last layout is always the
    // current one - the next load restores {x, y, w} from the cookie instead of
    // recomputing a default (edits already persist via commit(); Reset clears it).
    if (!hadSaved) writeSavedLayout(built)
  }, [cellSize, result, buildLayout])

  // Commit an edited layout: update state and persist {x, y, w}.
  const commit = useCallback((next: LayoutItem[]) => {
    setLayoutState(next)
    writeSavedLayout(next)
  }, [])

  // Publish the add/reset actions + the addable-widget list up to the header.
  useEffect(() => {
    if (!layout) {
      setGridActions(null)
      return
    }
    const placed = new Set(layout.map((i) => i.widgetId))
    const availableWidgets = WIDGET_REGISTRY.filter((w) => !placed.has(w.id)).map((w) => ({
      id: w.id,
      title: w.title,
    }))
    const addWidget = (id: string) => {
      const entry = getWidget(id)
      if (!entry || placed.has(id)) return
      const item: LayoutItem = { widgetId: id, x: 0, y: 0, w: entry.defaultSpan.w, h: measuredH(id) }
      commit(placeNew(layout, item))
    }
    const resetLayout = () => {
      clearLayout()
      setLayoutState(buildLayout()) // cookie now empty -> default measured pack
    }
    setGridActions({ availableWidgets, addWidget, resetLayout })
  }, [layout, measuredH, buildLayout, commit, setGridActions])

  // Clear published actions on unmount.
  useEffect(() => () => setGridActions(null), [setGridActions])

  // DEV-only standing guard: warn if any placed widget's content exceeds its cell
  // (fit math) or the layout has overlaps (reflow engine). Runs on every commit
  // via the layout dep. Never fires when correct; stripped from prod.
  useEffect(() => {
    if (!import.meta.env.DEV || !layout) return
    for (const item of layout) {
      if (getWidget(item.widgetId)?.lockHeight) continue // locked widgets scroll their own overflow
      const el = measureRefs.current.get(item.widgetId)
      const contentPx = el ? el.getBoundingClientRect().height : 0
      const cellPx = item.h * cellSize + (item.h - 1) * GRID_GAP
      if (contentPx - cellPx > 1) {
        console.warn(
          `${item.widgetId} CLIPS: content ${Math.round(contentPx)}px > cell ${Math.round(cellPx)}px`,
        )
      }
    }
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i]
        const b = layout[j]
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) {
          console.warn(`WidgetGrid overlap: ${a.widgetId} overlaps ${b.widgetId}`)
        }
      }
    }
  }, [layout, cellSize])

  // --- drag handlers (edit mode only) ---
  const step = cellSize + GRID_GAP

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, id: string) {
    if (!editMode || !layout) return
    if ((e.target as HTMLElement).closest('[data-remove]')) return // X handles its own
    const item = layout.find((i) => i.widgetId === id)
    if (!item) return
    const cardRect = e.currentTarget.getBoundingClientRect()
    dragStartRef.current = {
      id,
      snapshot: layout,
      px: e.clientX,
      py: e.clientY,
      gx: e.clientX - cardRect.left,
      gy: e.clientY - cardRect.top,
      sx: item.x,
      sy: item.y,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragStartRef.current
    if (!d || !gridRef.current) return
    const tx = e.clientX - d.px
    const ty = e.clientY - d.py
    if (!d.moved && Math.hypot(tx, ty) < DRAG_THRESHOLD) return // ignore taps
    d.moved = true
    const item = d.snapshot.find((i) => i.widgetId === d.id)
    if (!item) return
    const rect = gridRef.current.getBoundingClientRect() // live rect accounts for scroll
    const cardLeft = e.clientX - d.gx
    const cardTop = e.clientY - d.gy
    const col = Math.max(0, Math.min(Math.round((cardLeft - rect.left) / step), GRID_COLUMNS - item.w))
    const row = Math.max(0, Math.round((cardTop - rect.top) / step))
    // Non-displacing: the move only lands on open space. tryMoveElement returns
    // null when the target overlaps another widget -> invalid drop (snap back).
    const next = tryMoveElement(d.snapshot, d.id, col, row)
    setDrag({ id: d.id, tx, ty, valid: next !== null, next })
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = dragStartRef.current
    dragStartRef.current = null
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    // Commit only a real move onto open space; a sub-threshold move (click) or a
    // drop over another widget (drag.next === null) leaves the layout untouched.
    if (d?.moved && drag?.valid && drag.next) commit(drag.next)
    setDrag(null)
  }

  function onPointerCancel() {
    dragStartRef.current = null
    setDrag(null) // drop the preview, revert to the committed layout
  }

  // --- render ---
  // Other widgets never move (no reflow), so the grid always renders the
  // committed layout; only the dragged card translates to follow the pointer.
  const active = drag
  const items = layout ?? []

  return (
    <div ref={ref} className="relative w-full">
      {/* PASS 1 - hidden measurement layer for EVERY registry widget (so any can
          be added), each at its true column width with auto height. */}
      {cellSize > 0 && (
        <div aria-hidden className="pointer-events-none invisible absolute left-[-9999px] top-0">
          {WIDGET_REGISTRY.map((w) => (
            <div
              key={w.id}
              ref={(el) => {
                if (el) measureRefs.current.set(w.id, el)
                else measureRefs.current.delete(w.id)
              }}
              style={{ width: widgetPxWidth(w.defaultSpan.w, cellSize, GRID_GAP) }}
            >
              {w.render(result)}
            </div>
          ))}
        </div>
      )}

      {/* PASS 2 - the real grid. */}
      {layout ? (
        <div
          ref={gridRef}
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
            gridAutoRows: `${cellSize}px`,
            gap: `${GRID_GAP}px`,
          }}
        >
          {items.map((item) => {
            const widget = getWidget(item.widgetId)
            if (!widget) return null
            const isDragged = active?.id === item.widgetId
            // The dragged card stays in its START cell and follows the pointer via
            // translate; the others snap to their reflowed preview cells.
            const start = dragStartRef.current
            const x = isDragged && start ? start.sx : item.x
            const y = isDragged && start ? start.sy : item.y
            const style: CSSProperties = {
              gridColumn: `${x + 1} / span ${item.w}`,
              gridRow: `${y + 1} / span ${item.h}`,
            }
            if (isDragged && active) {
              style.transform = `translate(${active.tx}px, ${active.ty}px)`
              style.transition = 'none'
              style.zIndex = 50
            }
            return (
              <div
                key={item.widgetId}
                style={style}
                onPointerDown={editMode ? (e) => onPointerDown(e, item.widgetId) : undefined}
                onPointerMove={editMode ? onPointerMove : undefined}
                onPointerUp={editMode ? onPointerUp : undefined}
                onPointerCancel={editMode ? onPointerCancel : undefined}
                className={cn(
                  'relative h-full w-full',
                  editMode && 'cursor-grab select-none rounded-lg ring-1 ring-accent-teal/40 transition-transform duration-200 ease-out',
                  isDragged && 'cursor-grabbing shadow-lg shadow-black/40',
                  // Invalid drop target (over another widget): flag it red.
                  isDragged && active && !active.valid && 'ring-2 ring-accent-red',
                )}
              >
                <div className={cn('h-full w-full [&>*]:h-full', editMode && 'pointer-events-none select-none')}>
                  {widget.render(result)}
                </div>
                {editMode && (
                  <button
                    type="button"
                    data-remove
                    aria-label={`Remove ${widget.title}`}
                    title={`Remove ${widget.title}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => commit(removeWidget(layout, item.widgetId))}
                    className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-base bg-accent-red text-white shadow-md transition-transform duration-200 ease-out hover:scale-110"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <GridSkeleton />
      )}
    </div>
  )
}
