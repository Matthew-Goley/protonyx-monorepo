import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { X, LayoutGrid, ArrowRight } from 'lucide-react'
import { type Position } from '@/api/lens'
import { positionsApi } from '@/api/positions'
import { settingsApi, type RiskTier } from '@/api/settings'
import { useAuth } from '@/contexts/AuthContext'
import { RiskProfileCards } from '@/components/common/RiskProfileCards'
import { AddPositionModal } from '@/components/common/AddPositionModal'
import { useHotkey } from '@/hooks/useHotkey'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/lensData'

// Editorial onboarding: a thin full-width progress line pinned to the top edge,
// a bold left-aligned heading, and the primary action locked to the bottom of
// the viewport (fixed, right-aligned so it never shifts between steps).
const STEPS = [
  {
    title: 'How do you want to invest?',
    description: 'This shapes how aggressively Lens flags risks. You can change this in Settings.',
  },
  {
    title: 'Add Your Positions',
    description: 'Add one or more holdings.',
  },
]

export function Onboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { refreshUser } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [risk, setRisk] = useState<RiskTier | null>(null)
  const [positions, setPositionsState] = useState<Position[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [launching, setLaunching] = useState(false)

  // Press "a" on the portfolio-setup step to open the add-position modal.
  useHotkey('a', () => setModalOpen(true), step === 2 && !modalOpen)

  function addPosition(p: Position) {
    setPositionsState((prev) => {
      const without = prev.filter((x) => x.ticker !== p.ticker)
      return [...without, p]
    })
    setModalOpen(false)
  }

  function removePosition(ticker: string) {
    setPositionsState((prev) => prev.filter((p) => p.ticker !== ticker))
  }

  async function launch() {
    if (!risk || positions.length === 0 || launching) return
    setLaunching(true)
    try {
      // Persist the risk tier to the server (per user, Postgres) and refresh the
      // auth user so useLensAnalysis runs with the chosen tier. Then persist the
      // built portfolio to the server (bulk replace) and prime the ['positions']
      // cache with the saved rows before navigating, so the dashboard paints
      // without racing an empty fetch.
      await settingsApi.setRiskTier(risk)
      await refreshUser()
      const saved = await positionsApi.replacePositions(positions)
      qc.setQueryData(['positions'], saved)
      qc.invalidateQueries({ queryKey: ['lens-analysis'] })
      navigate('/dashboard', { replace: true })
    } catch {
      setLaunching(false)
    }
  }

  const meta = STEPS[step - 1]
  const frac = step / STEPS.length
  const canBack = step === 2
  const nextLabel = step === 1 ? 'Continue' : launching ? 'Launching...' : 'Launch Lens'
  const nextDisabled = step === 1 ? !risk : positions.length === 0 || launching
  const onNext = step === 1 ? () => setStep(2) : launch

  return (
    <div className="page-fade relative min-h-screen bg-base px-4 pt-16 pb-32">
      {/* Thin full-width progress line pinned to the top edge. */}
      <div className="fixed inset-x-0 top-0 z-20 h-1 bg-subtle">
        <div
          className="bg-gradient-brand h-full transition-all duration-500 ease-out"
          style={{ width: `${frac * 100}%` }}
        />
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-primary">{meta.title}</h2>
        <p className="mt-3 max-w-lg text-secondary">{meta.description}</p>

        <div className="mt-10">
          {step === 1 ? (
            <RiskProfileCards value={risk} onChange={setRisk} />
          ) : (
            <div>
              <div className="min-h-[180px]">
                {positions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-subtle py-14 text-center">
                    <LayoutGrid className="text-muted" size={32} />
                    <p className="mt-3 font-medium text-primary">No positions yet</p>
                  </div>
                ) : (
                  // Caps at 3 rows, then scrolls (inherits the app-wide scrollbar).
                  <div className="max-h-[276px] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
                    {positions.map((p) => (
                      <div
                        key={p.ticker}
                        className="relative flex items-center justify-between rounded-lg border border-subtle bg-card p-4"
                      >
                        <div>
                          <p className="text-2xl font-semibold leading-none text-primary">{p.ticker}</p>
                          <p className="mt-1.5 text-lg font-semibold text-secondary">
                            {formatCurrency(p.equity)}
                          </p>
                        </div>
                        <div className="pr-6 text-right">
                          <p className="text-lg font-semibold text-primary">{p.shares}</p>
                          <p className="text-xs text-secondary">shares</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePosition(p.ticker)}
                          aria-label={`Remove ${p.ticker}`}
                          className="absolute top-3 right-3 text-muted transition-colors hover:text-accent-red"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5">
                <Button variant="teal" onClick={() => setModalOpen(true)}>
                  Add Position (a)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Primary action locked to the bottom of the viewport. Right-aligned
          within the content column so it stays put whether or not Back shows. */}
      <div className="fixed inset-x-0 bottom-8 z-30 px-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          {canBack ? (
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button variant="gradient" onClick={onNext} disabled={nextDisabled}>
            {nextLabel}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>

      {modalOpen && <AddPositionModal onClose={() => setModalOpen(false)} onAdd={addPosition} />}
    </div>
  )
}
