import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { GRID_GAP, REFERENCE_CELL_SIZE } from '@/lib/widgetLayout'

/*
  Scale-to-fit wrapper for a locked-size widget.

  The widget's grid box has a fixed aspect ratio (w:h square cells) but its pixel
  size changes with the viewport width. So we render the widget content into a
  FIXED reference-size box (w x h cells at REFERENCE_CELL_SIZE) - where all the
  widget's hand-tuned px values are authored - and then uniformly transform:scale
  that box to the real cell. The content therefore fills its widget identically at
  any viewport, and the VS Code preview and a full browser render the same layout.

  Uniform scale (min of the two ratios) preserves aspect and never overflows; the
  tiny slack from the constant grid gap is centered and invisible.
*/
export function FitScale({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const refW = w * REFERENCE_CELL_SIZE + (w - 1) * GRID_GAP
  const refH = h * REFERENCE_CELL_SIZE + (h - 1) * GRID_GAP

  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      setScale(Math.min(r.width / refW, r.height / refH))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [refW, refH])

  return (
    <div
      ref={boxRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div
        className="shrink-0 [&>*]:h-full [&>*]:w-full"
        style={{ width: refW, height: refH, transform: `scale(${scale})`, transformOrigin: 'center' }}
      >
        {children}
      </div>
    </div>
  )
}
