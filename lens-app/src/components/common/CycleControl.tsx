/*
  Shared "cycle through views" control: a left + right rounded-triangle arrow
  pair with a centered label. Used by the Diversification pie (sector / ticker /
  type) and the Portfolio Vector widget (5 indicator styles). Reusable anywhere a
  panel steps through a small set of alternatives with wrap-around.
*/

// Rounded-corner triangle arrow. A filled path with a round-joined stroke of the
// same color rounds the three corners. `dir` flips the horizontal orientation.
export function CycleArrow({ dir }: { dir: 'left' | 'right' }) {
  const points = dir === 'left' ? '15,5 15,19 7,12' : '9,5 9,19 17,12'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <polygon
        points={points}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export interface CycleControlProps {
  label: string
  onPrev: () => void
  onNext: () => void
  className?: string
}

export function CycleControl({ label, onPrev, onNext, className }: CycleControlProps) {
  const btn =
    'flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors duration-200 ease-out hover:bg-card-hover hover:text-primary'
  return (
    <div className={`flex items-center justify-center gap-3 ${className ?? ''}`}>
      <button type="button" onClick={onPrev} className={btn} aria-label="Previous">
        <CycleArrow dir="left" />
      </button>
      <span className="min-w-[104px] text-center text-[13px] font-medium text-secondary">
        {label}
      </span>
      <button type="button" onClick={onNext} className={btn} aria-label="Next">
        <CycleArrow dir="right" />
      </button>
    </div>
  )
}
