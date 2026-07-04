import { useEffect, useRef, useState, type RefObject } from 'react'
import { GRID_COLUMNS, GRID_GAP } from '@/lib/widgetLayout'

/*
  Measures the grid container width with a ResizeObserver and derives the square
  cell size: cellSize = (containerWidth - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS.
  The grid then sets grid-auto-rows to this value so every row is exactly one
  column-width tall, making each cell square. cellSize is 0 until the first
  measurement; consumers should skip setting grid-auto-rows while it is 0.
*/
export interface GridMetrics {
  ref: RefObject<HTMLDivElement | null>
  cellSize: number
}

export function useGridMetrics(): GridMetrics {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cellSize, setCellSize] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = (width: number) => {
      const size = (width - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS
      setCellSize(size > 0 ? size : 0)
    }

    measure(el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, cellSize }
}
