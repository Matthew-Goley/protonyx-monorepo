/*
  Grid geometry + layout model for the dynamic dashboard grid.

  Two layers:
   - the base model: grid geometry, the first-fit packer (default placement),
     and the pure fit math that turns a measured pixel height into a row span.
   - the edit-mode helpers: pure, side-effect-free functions (collides /
     getColliders / tryMoveElement / placeNew / removeWidget) that power
     drag-to-reposition, add, and delete. Placement is manual and
     non-displacing: widgets never move to make room for one another. A move
     only lands if its destination is free, and add/delete leave every other
     widget exactly where it was. They operate on cloned layouts and never
     mutate React state in place.

  Width (w) is always the registry value (no resize this phase). Height (h) is
  always MEASURED, never trusted from persistence, so content growth can never
  restore a stale, clipping height.
*/

// Single source of truth for grid size. Everything derives from GRID_COLUMNS.
// 12 is chosen for clean divisibility (2 / 3 / 4 / 6); GRID_GAP matches the §6
// grid gutter (Tailwind gap-6 = 24px).
export const GRID_COLUMNS = 12
export const GRID_GAP = 24 // px

// A placed widget in grid-cell units: top-left (x, y) and footprint (w, h).
export interface LayoutItem {
  widgetId: string
  x: number
  y: number
  w: number
  h: number
}

// A widget's footprint before placement (id + size only).
interface Footprint {
  widgetId: string
  w: number
  h: number
}

// A persisted placement. h is intentionally dropped: it is always re-measured on
// read, so a widget that grew taller can never restore an old height that clips.
export interface SavedLayoutItem {
  widgetId: string
  x: number
  y: number
  w: number
}

/*
  First-fit packer. Places each widget, in the given order, at the first free
  slot found by scanning row by row (top-down), left to right, whose w x h
  footprint does not overlap an already-placed item and does not run past the
  right edge. Deterministic. Dense upward compaction (pulling widgets up to fill
  gaps) is a later refinement, not this phase.
*/
export function placeWidgets(widgets: Footprint[], columns = GRID_COLUMNS): LayoutItem[] {
  const placed: LayoutItem[] = []

  const overlaps = (x: number, y: number, w: number, h: number): boolean =>
    placed.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y)

  for (const widget of widgets) {
    const w = Math.min(widget.w, columns)
    const h = widget.h
    let px = 0
    let py = 0
    // A free slot always exists at x = 0 on some empty row, so this terminates.
    search: for (let y = 0; ; y++) {
      for (let x = 0; x <= columns - w; x++) {
        if (!overlaps(x, y, w, h)) {
          px = x
          py = y
          break search
        }
      }
    }
    placed.push({ widgetId: widget.widgetId, x: px, y: py, w, h })
  }

  return placed
}

/*
  Fit math - the whole clip-avoidance calculation, kept pure so it is trivially
  testable and shared between the measurement layer and the placer. Widths and
  heights are in pixels; cellSize/gap are the square-cell size and grid gap.
*/

// Pixel width of a w-column span.
export function widgetPxWidth(w: number, cellSize: number, gap: number): number {
  return w * cellSize + (w - 1) * gap
}

// Smallest whole row count N whose stacked pixel height contains contentPx,
// i.e. the smallest N where N*cellSize + (N-1)*gap >= contentPx.
export function rowsForHeight(contentPx: number, cellSize: number, gap: number): number {
  return Math.ceil((contentPx + gap) / (cellSize + gap))
}

// Row span for a widget: the registry floor or the measured fit, whichever is
// larger. The widget never renders shorter than its floor (preserving
// intentional shapes like the caution-score square) and never clips (the
// measured fit raises h whenever content needs more rows).
export function fitSpan(floorH: number, contentPx: number, cellSize: number, gap: number): number {
  return Math.max(floorH, rowsForHeight(contentPx, cellSize, gap))
}

// ---------------------------------------------------------------------------
// Edit-mode helpers - pure functions for drag / add / delete. Placement is
// MANUAL and NON-DISPLACING: no widget ever moves to make room for another. A
// move only lands if its destination is free; add finds the first free slot and
// disturbs nothing; delete just leaves a gap. Every mutating function clones its
// input first and returns a new array. Identity is the widgetId.
// ---------------------------------------------------------------------------

function cloneLayout(layout: LayoutItem[]): LayoutItem[] {
  return layout.map((i) => ({ ...i }))
}

// AABB overlap. Two items overlap unless one is fully to a side of the other; an
// item never collides with itself (matched by widgetId).
export function collides(a: LayoutItem, b: LayoutItem): boolean {
  if (a.widgetId === b.widgetId) return false
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

// Every item (other than `item` itself) that collides with `item`.
export function getColliders(layout: LayoutItem[], item: LayoutItem): LayoutItem[] {
  return layout.filter((other) => other.widgetId !== item.widgetId && collides(item, other))
}

// Try to move `movingId` to (tx, ty) clamped in bounds. Returns the new layout
// ONLY if the destination footprint is free (no other widget moves); returns
// null when the target overlaps another widget, so the caller can reject the
// drop and snap the widget back. This is the whole "no auto-reflow" rule: you
// must move a widget into open space, never over another.
export function tryMoveElement(
  layout: LayoutItem[],
  movingId: string,
  tx: number,
  ty: number,
  columns = GRID_COLUMNS,
): LayoutItem[] | null {
  const working = cloneLayout(layout)
  const moving = working.find((i) => i.widgetId === movingId)
  if (!moving) return null
  moving.x = Math.max(0, Math.min(tx, columns - moving.w))
  moving.y = Math.max(0, ty)
  if (getColliders(working, moving).length > 0) return null
  return working
}

// First-fit place a new item (scan y from 0, x left to right) at the first slot
// with no colliders. Nothing else moves. Returns the new layout.
export function placeNew(
  layout: LayoutItem[],
  item: LayoutItem,
  columns = GRID_COLUMNS,
): LayoutItem[] {
  const working = cloneLayout(layout)
  const candidate: LayoutItem = { ...item, w: Math.min(item.w, columns) }
  search: for (let y = 0; ; y++) {
    for (let x = 0; x <= columns - candidate.w; x++) {
      candidate.x = x
      candidate.y = y
      if (getColliders(working, candidate).length === 0) break search
    }
  }
  working.push(candidate)
  return working
}

// Remove an item by id. The gap it leaves stays open (no compaction). Returns
// the new layout.
export function removeWidget(layout: LayoutItem[], id: string): LayoutItem[] {
  return cloneLayout(layout).filter((i) => i.widgetId !== id)
}
