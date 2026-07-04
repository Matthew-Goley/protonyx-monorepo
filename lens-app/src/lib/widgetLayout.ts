import { WIDGET_REGISTRY } from '@/lib/widgetRegistry'

/*
  Grid geometry + layout model - the substrate for the dynamic dashboard grid.

  This phase is static placement only: a coordinate model, a deterministic
  first-fit packer, and a default layout derived from the registry. No drag,
  add-menu, resize or collision behavior lives here yet. The later drag/edit
  phase only has to mutate LayoutItem coordinates and persist them (the cookie
  accessors already exist), so it is purely additive on top of this.
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

/*
  Default layout: the registry's default-visible widgets, in registry order, run
  through the packer. Reordering the registry array is the only way to rearrange
  the dashboard until the drag/edit phase lands - that is expected for now.
  Computed lazily (not a module-level const) so it never reads the registry
  during module initialization, keeping the registry <-> layout <-> cookies
  import cycle safe.
*/
export function getDefaultLayout(): LayoutItem[] {
  const footprints: Footprint[] = WIDGET_REGISTRY.filter((w) => w.defaultVisible).map((w) => ({
    widgetId: w.id,
    w: w.defaultSpan.w,
    h: w.defaultSpan.h,
  }))
  return placeWidgets(footprints, GRID_COLUMNS)
}
