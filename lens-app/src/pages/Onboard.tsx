import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, LayoutGrid } from 'lucide-react'
import { type Position } from '@/api/lens'
import { setPositions, setSettings, type RiskTier } from '@/lib/cookies'
import { RiskProfileCards } from '@/components/common/RiskProfileCards'
import { AddPositionModal } from '@/components/common/AddPositionModal'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/lensData'
import { cn } from '@/lib/utils'

function StepDots({ step }: { step: 1 | 2 }) {
  const items = [
    { n: 1, label: 'Risk Profile' },
    { n: 2, label: 'Portfolio Setup' },
  ]
  return (
    <div className="mb-10 flex items-center justify-center">
      {items.map((it, i) => {
        const done = step > it.n
        const active = step === it.n
        return (
          <div key={it.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold',
                  done && 'bg-accent-teal text-base',
                  active && 'bg-gradient-brand text-base',
                  !done && !active && 'border border-subtle bg-card text-muted',
                )}
              >
                {done ? <Check size={16} /> : it.n}
              </div>
              <span
                className={cn(
                  'mt-2 text-xs',
                  active || done ? 'text-primary' : 'text-muted',
                )}
              >
                {it.label}
              </span>
            </div>
            {i === 0 && <div className="mx-4 h-px w-20 bg-subtle" />}
          </div>
        )
      })}
    </div>
  )
}

export function Onboard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [risk, setRisk] = useState<RiskTier | null>(null)
  const [positions, setPositionsState] = useState<Position[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen] = useState(false)

  function addPosition(p: Position) {
    setPositionsState((prev) => {
      const without = prev.filter((x) => x.ticker !== p.ticker)
      return [...without, p]
    })
    setModalOpen(false)
  }

  function removePosition(ticker: string) {
    setPositionsState((prev) => prev.filter((p) => p.ticker !== ticker))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(ticker)
      return next
    })
  }

  function toggleSelect(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  function removeSelected() {
    setPositionsState((prev) => prev.filter((p) => !selected.has(p.ticker)))
    setSelected(new Set())
  }

  function launch() {
    if (!risk || positions.length === 0) return
    setSettings({ risk_tier: risk })
    setPositions(positions)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-base px-4 py-16">
      <div className="mx-auto w-full max-w-2xl">
        <StepDots step={step} />

        {step === 1 ? (
          <div>
            <h2 className="text-2xl font-bold text-primary">How do you want to invest?</h2>
            <p className="mt-2 text-secondary">
              This shapes how aggressively Lens flags risks. You can change this in Settings.
            </p>
            <div className="mt-8">
              <RiskProfileCards value={risk} onChange={setRisk} />
            </div>
            <div className="mt-8 flex justify-end">
              <Button variant="gradient" disabled={!risk} onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-primary">Add Your Positions</h2>
            <p className="mt-2 text-secondary">
              Add one or more holdings. Lens validates each ticker before saving.
            </p>

            <div className="mt-8 min-h-[180px]">
              {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-subtle py-14 text-center">
                  <LayoutGrid className="text-muted" size={32} />
                  <p className="mt-3 font-medium text-primary">No positions yet</p>
                  <p className="mt-1 text-sm text-secondary">
                    Add at least one holding to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((p) => {
                    const isSel = selected.has(p.ticker)
                    return (
                      <div
                        key={p.ticker}
                        onClick={() => toggleSelect(p.ticker)}
                        className={cn(
                          'relative cursor-pointer rounded-xl border p-5 transition-colors',
                          isSel
                            ? 'border-accent-teal bg-accent-teal/5'
                            : 'border-subtle bg-card hover:border-accent-teal/40',
                        )}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removePosition(p.ticker)
                          }}
                          className="absolute right-4 top-4 text-muted hover:text-accent-red"
                        >
                          <X size={18} />
                        </button>
                        <p className="text-2xl font-bold text-primary">{p.ticker}</p>
                        <p className="mt-1 text-sm text-secondary">
                          {p.shares} shares · {formatCurrency(p.price)} ·{' '}
                          {formatCurrency(p.equity)} · {p.sector}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="teal" onClick={() => setModalOpen(true)}>
                Add Position
              </Button>
              <Button variant="red" onClick={removeSelected} disabled={selected.size === 0}>
                Remove Selected
              </Button>
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-subtle pt-6">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="gradient" disabled={positions.length === 0} onClick={launch}>
                Launch Lens
              </Button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <AddPositionModal onClose={() => setModalOpen(false)} onAdd={addPosition} />
      )}
    </div>
  )
}
