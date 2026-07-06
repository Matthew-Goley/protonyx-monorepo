import { Logo } from './Logo'

/*
  PageLoader — the app's loading treatment: a rotating brand-gradient ring around
  a breathing Lens Arc icon, with a status label beneath. Page-agnostic (it fills
  and centers within its container), so any page's loading branch can render it as
  `<PageLoader />`. Keyframes are in the inline <style> below to keep it
  self-contained.
*/

export function PageLoader({ label = 'Running Lens analysis' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <LoaderKeyframes />
      <div className="relative flex h-28 w-28 items-center justify-center">
        <svg className="pl-spin absolute inset-0 h-full w-full" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="pl-arc-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="44" fill="none" stroke="#2a2d35" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#pl-arc-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="70 210"
          />
        </svg>
        <Logo variant="icon" className="pl-breathe h-10 w-auto" />
      </div>
      <p className="mt-6 text-sm text-secondary">{label}…</p>
    </div>
  )
}

function LoaderKeyframes() {
  return (
    <style>{`
      @keyframes pl-spin { to { transform: rotate(360deg); } }
      .pl-spin { animation: pl-spin 1.1s linear infinite; transform-origin: center; }

      @keyframes pl-breathe { 0%, 100% { opacity: 0.55; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1); } }
      .pl-breathe { animation: pl-breathe 1.6s ease-in-out infinite; }
    `}</style>
  )
}
