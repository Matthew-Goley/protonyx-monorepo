import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { GRID_COLUMNS, GRID_GAP } from '@/lib/widgetLayout'

// Horizontal padding of <main> (p-8 = 32px each side) - used to derive the
// content-box width the centered grid is measured against.
const MAIN_PX = 32

/** Top bar + sidebar + scrollable main content area shared by every authed page.
 *  The Sidebar (z-20) is layered above the TopBar (z-10) so it overlaps it. */
export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // Tick-grid tile size + horizontal offset, derived so the background crosses
  // align to the real dashboard grid at 3 crosses per grid unit (one grid unit =
  // a column + its gap). Null until measured (falls back to the CSS default).
  const [tick, setTick] = useState<{ size: number; x: number } | null>(null)

  useEffect(() => {
    const content = contentRef.current
    const main = mainRef.current
    if (!content || !main) return
    const measure = () => {
      const gridW = content.clientWidth
      if (gridW <= 0) return
      const cell = (gridW - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS
      const size = (cell + GRID_GAP) / 3 // 3 crosses per column+gap
      const mainContentW = main.clientWidth - MAIN_PX * 2
      const x = Math.max(0, (mainContentW - gridW) / 2) // centering offset of the grid
      setTick({ size, x })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(content)
    ro.observe(main)
    return () => ro.disconnect()
  }, [])

  // Position the tick pattern from the content box (grid origin), offset to the
  // centered grid's left edge, so crosses track the dashboard cells.
  const tickStyle: CSSProperties | undefined = tick
    ? {
        backgroundSize: `${tick.size}px ${tick.size}px`,
        backgroundPosition: `${tick.x}px 0`,
        backgroundOrigin: 'content-box',
      }
    : undefined

  return (
    <div className="min-h-screen bg-base">
      <TopBar />
      <Sidebar />
      {/* Tick-grid canvas lives on the root dashboard surface only (styling.md),
          sized/offset to align with the dashboard grid (see the effect above). */}
      <main
        ref={mainRef}
        style={tickStyle}
        className="tick-grid-bg ml-[220px] min-h-screen overflow-y-auto p-8 pt-[5.5rem]"
      >
        <div ref={contentRef} className="page-fade mx-auto max-w-[1280px]">
          {children}
        </div>
      </main>
    </div>
  )
}
