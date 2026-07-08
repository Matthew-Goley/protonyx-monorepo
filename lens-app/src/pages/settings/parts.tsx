import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
import {
  DATE_FORMATS,
  VOLATILITY_LOOKBACKS,
  MONTE_CARLO_PERIODS,
  MONTE_CARLO_SIMULATIONS,
} from '@/api/settings'
import { RiskProfileCards } from '@/components/common/RiskProfileCards'
import { AddPositionModal } from '@/components/common/AddPositionModal'
import { EditPositionModal } from '@/components/common/EditPositionModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type SettingsController } from './useSettingsController'

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/* ---------- shared primitives ---------- */

export function Dropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="rounded-md border border-subtle bg-base px-3 py-2 text-sm text-primary transition-all duration-200 ease-out focus:border-accent-teal focus:outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

export function NumberRow({
  label,
  value,
  step,
  onCommit,
}: {
  label: string
  value: number
  step?: number
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function commit() {
    const n = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(n)) {
      if (n !== value) onCommit(n)
    } else {
      setDraft(String(value))
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-secondary">{label}</span>
      <input
        type="number"
        step={step ?? 'any'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        className="w-24 rounded-md border border-subtle bg-base px-3 py-2 text-right text-sm text-primary transition-all duration-200 ease-out focus:border-accent-teal focus:outline-none"
      />
    </div>
  )
}

function ResetRow({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-4">
      <Button variant="ghost" size="sm" onClick={onReset}>
        Reset to defaults
      </Button>
    </div>
  )
}

/* ---------- section content (Panel-agnostic: wrap as each design likes) ---------- */

export function GeneralControls({ ctrl }: { ctrl: SettingsController }) {
  return (
    <div className="space-y-4">
      <Dropdown
        label="Theme"
        options={['Dark', 'Light']}
        value={ctrl.theme === 'light' ? 'Light' : 'Dark'}
        onChange={(v) => ctrl.setTheme(v === 'Light' ? 'light' : 'dark')}
      />
      <Dropdown
        label="Date Format"
        options={[...DATE_FORMATS]}
        value={ctrl.settings.date_format}
        onChange={(v) => ctrl.update({ date_format: v })}
      />
    </div>
  )
}

export function InvestmentStyleControls({ ctrl }: { ctrl: SettingsController }) {
  return <RiskProfileCards value={ctrl.risk} onChange={ctrl.changeRisk} />
}

export function SubscriptionControls({ ctrl }: { ctrl: SettingsController }) {
  const { pro, portalLoading, billingError, handleManageBilling, handleUpgrade } = ctrl
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-secondary">Plan</span>
        {pro ? (
          <span className="rounded-full border border-accent-teal/30 bg-accent-teal/10 px-3 py-1 text-xs font-medium text-accent-teal">
            Pro
          </span>
        ) : (
          <span className="rounded-full border border-subtle px-3 py-1 text-xs font-medium text-secondary">
            Free
          </span>
        )}
      </div>
      {billingError && <p className="mt-3 text-sm text-accent-red">{billingError}</p>}
      <div className="mt-4">
        {pro ? (
          <Button variant="outline" onClick={handleManageBilling} disabled={portalLoading}>
            {portalLoading ? 'Opening billing portal...' : 'Manage Billing'}
          </Button>
        ) : (
          <Button variant="gradient" onClick={handleUpgrade} disabled={portalLoading}>
            {portalLoading ? 'Redirecting...' : 'Upgrade to Lens Pro'}
          </Button>
        )}
      </div>
    </div>
  )
}

export function DataResetControls({ ctrl }: { ctrl: SettingsController }) {
  const { clearConfirm, setClearConfirm, handleClearData } = ctrl
  return (
    <div className="text-sm text-secondary">
      <p className="mb-4">
        Clears all stored data (positions, risk profile, and dashboard layout) and
        restarts onboarding. This does not affect your account.
      </p>
      {clearConfirm ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-primary">Clear all data and re-run onboarding?</span>
          <Button variant="red" onClick={handleClearData}>
            Yes, clear it
          </Button>
          <Button variant="ghost" onClick={() => setClearConfirm(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setClearConfirm(true)}>
          Clear Data & Restart Onboarding
        </Button>
      )}
    </div>
  )
}

export function AboutControls({ ctrl }: { ctrl: SettingsController }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-secondary">App Version</span>
        <span className="text-[12px] text-secondary">
          v{__APP_VERSION__} · API {ctrl.apiStatus}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-secondary">Brand</span>
        <span className="text-primary">Lens Arc by Protonyx</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-secondary">Credits</span>
        <span className="text-primary">FastAPI, yfinance, React</span>
      </div>
    </div>
  )
}

export function DirectionThresholdsControls({ ctrl }: { ctrl: SettingsController }) {
  const { settings, setDirection, resetDirection } = ctrl
  return (
    <div>
      <p className="mb-4 text-sm text-secondary">
        Slope cutoffs (fraction per period) that classify a holding's direction.
      </p>
      <div className="space-y-3">
        <NumberRow label="Strong" step={0.01} value={settings.direction_thresholds.strong} onCommit={(v) => setDirection('strong', v)} />
        <NumberRow label="Steady" step={0.01} value={settings.direction_thresholds.steady} onCommit={(v) => setDirection('steady', v)} />
        <NumberRow label="Neutral (high)" step={0.01} value={settings.direction_thresholds.neutral_high} onCommit={(v) => setDirection('neutral_high', v)} />
        <NumberRow label="Neutral (low)" step={0.01} value={settings.direction_thresholds.neutral_low} onCommit={(v) => setDirection('neutral_low', v)} />
        <NumberRow label="Depreciating" step={0.01} value={settings.direction_thresholds.depreciating} onCommit={(v) => setDirection('depreciating', v)} />
      </div>
      <ResetRow onReset={resetDirection} />
    </div>
  )
}

export function VolatilityControls({ ctrl }: { ctrl: SettingsController }) {
  const { settings, setVolatility, resetVolatility } = ctrl
  return (
    <div>
      <p className="mb-4 text-sm text-secondary">
        Lookback window and the low/high annualized-volatility cutoffs (%).
      </p>
      <div className="space-y-3">
        <Dropdown
          label="Lookback"
          options={[...VOLATILITY_LOOKBACKS]}
          value={settings.volatility.lookback}
          onChange={(v) => setVolatility('lookback', v)}
        />
        <NumberRow label="Low cutoff (%)" value={settings.volatility.low_cutoff} onCommit={(v) => setVolatility('low_cutoff', v)} />
        <NumberRow label="High cutoff (%)" value={settings.volatility.high_cutoff} onCommit={(v) => setVolatility('high_cutoff', v)} />
      </div>
      <ResetRow onReset={resetVolatility} />
    </div>
  )
}

export function LensSignalsControls({ ctrl }: { ctrl: SettingsController }) {
  const { settings, setSignal, resetSignals } = ctrl
  return (
    <div>
      <p className="mb-4 text-sm text-secondary">The trigger levels the Lens engine uses to flag risks.</p>
      <div className="space-y-3">
        <NumberRow label="Stock concentration (%)" value={settings.lens_signals.stock_concentration_pct} onCommit={(v) => setSignal('stock_concentration_pct', v)} />
        <NumberRow label="Sector concentration (%)" value={settings.lens_signals.sector_concentration_pct} onCommit={(v) => setSignal('sector_concentration_pct', v)} />
        <NumberRow label="Steep downtrend (%)" value={settings.lens_signals.steep_downtrend_pct} onCommit={(v) => setSignal('steep_downtrend_pct', v)} />
        <NumberRow label="High beta threshold" step={0.1} value={settings.lens_signals.high_beta_threshold} onCommit={(v) => setSignal('high_beta_threshold', v)} />
        <NumberRow label="Stock volatility (%)" value={settings.lens_signals.stock_vol_threshold_pct} onCommit={(v) => setSignal('stock_vol_threshold_pct', v)} />
        <NumberRow label="Dead weight (%)" value={settings.lens_signals.dead_weight_pct} onCommit={(v) => setSignal('dead_weight_pct', v)} />
        <NumberRow label="Loss threshold (%)" value={settings.lens_signals.loss_threshold} onCommit={(v) => setSignal('loss_threshold', v)} />
        <NumberRow label="Winner drift multiple" step={0.1} value={settings.lens_signals.winner_drift_multiple} onCommit={(v) => setSignal('winner_drift_multiple', v)} />
      </div>
      <ResetRow onReset={resetSignals} />
    </div>
  )
}

export function MonteCarloControls({ ctrl }: { ctrl: SettingsController }) {
  const { settings, setMonteCarlo, resetMonteCarlo } = ctrl
  return (
    <div>
      <p className="mb-4 text-sm text-secondary">Projection horizon and number of simulated paths.</p>
      <div className="space-y-3">
        <Dropdown
          label="Projection period"
          options={[...MONTE_CARLO_PERIODS]}
          value={settings.monte_carlo.projection_period}
          onChange={(v) => setMonteCarlo('projection_period', v)}
        />
        <Dropdown
          label="Simulations"
          options={MONTE_CARLO_SIMULATIONS.map(String)}
          value={String(settings.monte_carlo.simulations)}
          onChange={(v) => setMonteCarlo('simulations', Number(v))}
        />
      </div>
      <ResetRow onReset={resetMonteCarlo} />
    </div>
  )
}

/* ---------- the star of the show: a searchable, scrollable positions manager ----------
   Reused by all five designs. Fixed-height scroll area so 200 holdings never blow out
   the page. Per-row edit/delete, plus a prominent Add button and a live search filter.
   Renders the Add/Edit modals itself (each design mounts exactly one of these). */
export function PositionsManagerPanel({
  ctrl,
  heightClass = 'max-h-[420px]',
  compact = false,
}: {
  ctrl: SettingsController
  heightClass?: string
  compact?: boolean
}) {
  const { positions, selected, setSelected, setModalOpen, setEditOpen, removeTicker } = ctrl
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      q
        ? positions.filter(
            (p) =>
              p.ticker.toLowerCase().includes(q) ||
              (p.name ?? '').toLowerCase().includes(q),
          )
        : positions,
    [positions, q],
  )

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[180px] flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
          />
          <input
            type="text"
            placeholder="Search holdings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 w-full rounded-md border border-subtle bg-base pl-9 pr-3 text-sm text-primary placeholder:text-muted transition-colors duration-200 ease-out focus:border-accent-teal focus:outline-none"
          />
        </div>
        <Button variant="gradient" onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Add Position
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-3 px-3 text-[11px] uppercase tracking-wider text-secondary">
        <span className="min-w-0 flex-1">
          {positions.length} holdings{query ? ` · ${filtered.length} shown` : ''}
        </span>
        <span className="w-20 text-right">Shares</span>
        <span aria-hidden className="w-4 text-center text-muted">|</span>
        <span className="w-28 text-right">Value</span>
        <span aria-hidden className="w-16" />
      </div>

      <div className={cn('mt-2 min-h-0 flex-1 overflow-y-auto pr-1', heightClass)}>
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-subtle py-12 text-center">
            <p className="text-sm text-muted">No positions yet.</p>
            <Button variant="teal" size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={15} />
              Add your first holding
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No holdings match "{query}".</p>
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((p) => {
              const isSel = selected === p.ticker
              return (
                <li key={p.ticker}>
                  <div
                    onClick={() => setSelected(isSel ? null : p.ticker)}
                    className={cn(
                      'group flex cursor-pointer items-center gap-3 rounded-md border px-3 transition-all duration-200 ease-out',
                      compact ? 'py-2' : 'py-2.5',
                      isSel
                        ? 'border-accent-teal bg-accent-teal/5'
                        : 'border-subtle hover:border-accent-teal/40 hover:bg-card-hover',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-primary">{p.ticker}</span>
                      {!compact && p.name && (
                        <span className="block truncate text-xs text-secondary">{p.name}</span>
                      )}
                    </span>
                    <span className="w-20 shrink-0 text-right text-base font-medium text-primary">
                      {p.shares} sh
                    </span>
                    <span aria-hidden className="w-4 shrink-0" />
                    <span className="w-28 shrink-0 text-right text-base text-primary">
                      {money(p.equity)}
                    </span>
                    <span className="flex w-16 shrink-0 items-center justify-end gap-1 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label={`Edit ${p.ticker}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelected(p.ticker)
                          setEditOpen(true)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors duration-200 ease-out hover:bg-base hover:text-accent-teal"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${p.ticker}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeTicker(p.ticker)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors duration-200 ease-out hover:bg-base hover:text-accent-red"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <PositionsModals ctrl={ctrl} />
    </div>
  )
}

/** The Add/Edit modals, mounted once by each PositionsManagerPanel. */
function PositionsModals({ ctrl }: { ctrl: SettingsController }) {
  const { modalOpen, setModalOpen, editOpen, setEditOpen, selectedPosition, addPosition, editShares } =
    ctrl
  return (
    <>
      {modalOpen && <AddPositionModal onClose={() => setModalOpen(false)} onAdd={addPosition} />}
      {editOpen && selectedPosition && (
        <EditPositionModal
          position={selectedPosition}
          onClose={() => setEditOpen(false)}
          onSave={editShares}
        />
      )}
    </>
  )
}
