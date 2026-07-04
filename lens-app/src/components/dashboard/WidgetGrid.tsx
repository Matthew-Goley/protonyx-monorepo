import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type LensResult } from '@/api/lens'
import {
  GRID_COLUMNS,
  GRID_GAP,
  fitSpan,
  placeWidgets,
  widgetPxWidth,
  type LayoutItem,
} from '@/lib/widgetLayout'
import { WIDGET_REGISTRY, getWidget } from '@/lib/widgetRegistry'
import { useGridMetrics } from '@/hooks/useGridMetrics'

/*
  Data-driven dashboard widget grid - measure-then-place (self-correcting).

  Row spans are no longer static guesses. Each load runs a two-pass render:

    PASS 1 (measure): an off-screen layer renders every visible widget at its
    true column pixel width with auto height, so each reports its natural
    rendered content height (width matters: text wrap and responsive charts
    change height).

    COMPUTE: for each widget finalH = fitSpan(floor, measuredPx, cellSize, gap)
    (floor = registry defaultSpan.h), finalW = defaultSpan.w. The existing
    first-fit packer turns those footprints (in registry order) into x/y. The
    coordinate + packer + square-cell model is unchanged, so the future
    drag/add-menu phase stays additive; the ONLY new thing is that h is measured.

    PASS 2 (place): the real grid renders that layout at explicit coordinates,
    each cell wrapping render(result) in the h-full [&>*]:h-full stretch so the
    outer Panel fills its now-correctly-sized cell without touching internals.

  Placement is recomputed on every load and whenever cellSize (resize) or result
  (content) changes, so it self-corrects for ANY portfolio with zero span
  tuning. The lens_layout cookie is intentionally NOT read here: a persisted
  layout would carry a stale measured h once content height changes, so
  placement stays live-computed until the drag phase writes explicit user
  layouts. The grid sets no fixed height, so it grows with content and inherits
  the AppShell <main> scroll (a vertical scrollbar appears only when the page
  exceeds the viewport).
*/

const VISIBLE_WIDGETS = WIDGET_REGISTRY.filter((w) => w.defaultVisible)

// Static dim placeholder shown for the single frame before the cell size is
// measured and the layout is computed (styling.md §Motion: no pulse).
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
  // Measurement boxes keyed by widget id (PASS 1 targets).
  const measureRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [layout, setLayout] = useState<LayoutItem[] | null>(null)

  // Measure + compute + place. useLayoutEffect so the computed layout commits
  // before paint (no flicker of a wrong-sized grid). Keyed on cellSize + result
  // so a resize or a content change re-measures and re-packs.
  useLayoutEffect(() => {
    if (cellSize <= 0) return
    const footprints = VISIBLE_WIDGETS.map((w) => {
      const el = measureRefs.current.get(w.id)
      const measuredPx = el ? el.getBoundingClientRect().height : 0
      return {
        widgetId: w.id,
        w: w.defaultSpan.w,
        h: fitSpan(w.defaultSpan.h, measuredPx, cellSize, GRID_GAP),
      }
    })
    setLayout(placeWidgets(footprints, GRID_COLUMNS))
  }, [cellSize, result])

  // DEV-only standing regression guard: verify no placed widget's content
  // exceeds its cell (fit math correct) and the packer produced no overlaps.
  // Never fires when the math is right; ships harmlessly (stripped in prod).
  useEffect(() => {
    if (!import.meta.env.DEV || !layout) return
    for (const item of layout) {
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

  return (
    <div ref={ref} className="relative w-full">
      {/* PASS 1 - hidden measurement layer. In layout (visibility:hidden, not
          display:none) so boxes actually measure; each is exactly its column
          pixel width with auto height. Kept mounted so resize/result recompute
          can re-measure. */}
      {cellSize > 0 && (
        <div aria-hidden className="pointer-events-none invisible absolute left-[-9999px] top-0">
          {VISIBLE_WIDGETS.map((w) => (
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

      {/* PASS 2 - the real grid at computed coordinates. */}
      {layout ? (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
            gridAutoRows: `${cellSize}px`,
            gap: `${GRID_GAP}px`,
          }}
        >
          {layout.map((item) => {
            const widget = getWidget(item.widgetId)
            if (!widget) return null
            return (
              <div
                key={item.widgetId}
                className="h-full w-full [&>*]:h-full"
                style={{
                  gridColumn: `${item.x + 1} / span ${item.w}`,
                  gridRow: `${item.y + 1} / span ${item.h}`,
                }}
              >
                {widget.render(result)}
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
