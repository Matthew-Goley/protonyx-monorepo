import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type LensResult } from '@/api/lens'
import { getPositions } from '@/lib/cookies'
import { tokenizeBrief, type BriefKind } from '@/lib/lensData'

/*
  The Lens Brief text, rendered as an auto-fitting "generating" readout.

  Two behaviors combine:
   - Typewriter: the brief reveals one character at a time (each fades in via the
     .gb-char keyframe), generating over ~1.4s.
   - Auto-fit: on every step the largest font (within [MIN,MAX]) whose revealed
     text fits the box height is chosen by a quick binary search against a hidden
     measurer. Few characters fit at a large size, so as the text fills the box the
     font shrinks - and when generation finishes the text is the largest size that
     exactly fills the space up to the divider line above the Analysis button.

  The widget height is locked (lens-brief lockHeight), so this fills a fixed box.
*/

const KIND_CLASS: Record<BriefKind, string> = {
  plain: '',
  ticker: 'font-medium text-accent-teal',
  money: 'text-accent-teal',
  percent: 'text-accent-teal',
  action: 'font-medium text-accent-blue',
}

const MIN_FONT = 13 // px - never smaller than easily readable
const MAX_FONT = 38 // px - readable ceiling; fit shrinks below this as text fills
const LINE_HEIGHT = 1.5
const DURATION_MS = 1400

export function GeneratingBrief({ result }: { result: LensResult }) {
  const text = result.brief

  const tickers = useMemo(
    () => [...getPositions().map((p) => p.ticker), ...(result.recommended_tickers ?? [])],
    [result.recommended_tickers],
  )

  // Flatten the colored brief into per-character cells so each char can fade in
  // individually while keeping its segment color.
  const chars = useMemo(() => {
    const segs = tokenizeBrief(text, tickers)
    return segs.flatMap((s) => [...s.text].map((c) => ({ c, kind: s.kind })))
  }, [text, tickers])
  const total = chars.length

  const boxRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLParagraphElement>(null)
  const [revealed, setRevealed] = useState(0)
  const [fontPx, setFontPx] = useState(MIN_FONT)
  const [resizeTick, setResizeTick] = useState(0)

  // Typewriter: reveal characters over DURATION on mount / when the brief changes.
  useEffect(() => {
    setRevealed(0)
    let raf = 0
    let startT = 0
    const tick = (t: number) => {
      if (!startT) startT = t
      const p = Math.min(1, (t - startT) / DURATION_MS)
      setRevealed(Math.max(1, Math.round(p * total)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [total])

  // Re-fit when the box resizes (grid edits, window resize, or first layout).
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => setResizeTick((t) => t + 1))
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  // Fit: pick the largest font whose currently-revealed text fits the box height.
  useLayoutEffect(() => {
    const box = boxRef.current
    const m = measureRef.current
    if (!box || !m) return
    const boxH = box.clientHeight
    const boxW = box.clientWidth
    if (boxH <= 0 || boxW <= 0) return
    m.style.width = `${boxW}px`
    m.textContent = chars.slice(0, revealed).map((x) => x.c).join('')
    let lo = MIN_FONT
    let hi = MAX_FONT
    let best = MIN_FONT
    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2
      m.style.fontSize = `${mid}px`
      if (m.scrollHeight <= boxH) {
        best = mid
        lo = mid
      } else {
        hi = mid
      }
    }
    setFontPx(best)
  }, [revealed, chars, resizeTick])

  return (
    <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden">
      {/* Hidden measurer: same width / line-height / font as the visible text. */}
      <p
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 m-0"
        style={{ lineHeight: LINE_HEIGHT, whiteSpace: 'normal' }}
      />
      <p className="text-primary" style={{ fontSize: `${fontPx}px`, lineHeight: LINE_HEIGHT }}>
        {chars.slice(0, revealed).map((ch, i) => (
          <span key={i} className={`gb-char ${KIND_CLASS[ch.kind]}`}>
            {ch.c}
          </span>
        ))}
      </p>
    </div>
  )
}
