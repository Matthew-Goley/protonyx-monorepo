import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { isSubscribed } from '@/lib/subscription'
import { lensApi, type Position } from '@/api/lens'
import { positionsApi } from '@/api/positions'
import {
  settingsApi,
  DATE_FORMATS,
  VOLATILITY_LOOKBACKS,
  MONTE_CARLO_PERIODS,
  MONTE_CARLO_SIMULATIONS,
  DEFAULT_USER_SETTINGS,
  type RiskTier,
} from '@/api/settings'
import { usePositionsManager } from '@/hooks/usePositionsManager'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useHotkey } from '@/hooks/useHotkey'
import { BACKEND_URL } from '@/lib/backend'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel } from '@/components/common/Panel'
import { RiskProfileCards } from '@/components/common/RiskProfileCards'
import { AddPositionModal } from '@/components/common/AddPositionModal'
import { EditPositionModal } from '@/components/common/EditPositionModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel>
      <h3 className="mb-4 text-xl font-semibold text-primary">{title}</h3>
      {children}
    </Panel>
  )
}

function Collapsible({ title, children }: { title: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Panel className="p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <span className="text-base font-medium text-primary">{title}</span>
        <ChevronRight
          size={18}
          className={cn('text-secondary transition-transform duration-200 ease-out', open && 'rotate-90')}
        />
      </button>
      {open && (
        <div className="border-t border-subtle p-6 text-sm text-secondary">
          {children ?? 'Configuration for this section is coming soon.'}
        </div>
      )}
    </Panel>
  )
}

function Dropdown({
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
    <div className="flex items-center justify-between">
      <span className="text-sm text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="rounded-md border border-subtle bg-base px-4 py-2.5 text-sm text-primary transition-all duration-200 ease-out focus:border-accent-teal focus:outline-none"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

// A labelled numeric input that edits locally and commits on blur / Enter, so a
// tuning value isn't PUT to the server on every keystroke. Reverts to the prop
// value on an empty / non-numeric entry. Syncs down when the prop changes.
function NumberRow({
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
        className="w-28 rounded-md border border-subtle bg-base px-3 py-2 text-right text-sm text-primary transition-all duration-200 ease-out focus:border-accent-teal focus:outline-none"
      />
    </div>
  )
}

export function Settings() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const pro = isSubscribed(user)

  const manager = usePositionsManager()
  const positions = manager.positions
  // Server-stored app settings (theme is handled via ThemeContext; the rest here).
  const { settings, update } = useUserSettings()
  // Risk tier is server-stored (Postgres, via /me). Mirror it into local state for
  // instant UI feedback on change, and keep it in sync when the auth user updates.
  const [risk, setRisk] = useState<RiskTier>(user?.risk_tier ?? 'regular')
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const [clearConfirm, setClearConfirm] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<string>('checking...')

  // Press "a" to open the add-position modal (matches Onboard + the dashboard).
  useHotkey('a', () => setModalOpen(true), !modalOpen)

  useEffect(() => {
    lensApi
      .health()
      .then((h) => setApiStatus(h.status))
      .catch(() => setApiStatus('unavailable'))
  }, [])

  // Keep the local mirror in sync if the auth user's tier changes elsewhere.
  useEffect(() => {
    if (user?.risk_tier) setRisk(user.risk_tier)
  }, [user?.risk_tier])

  async function changeRisk(tier: RiskTier) {
    setRisk(tier)
    await settingsApi.setRiskTier(tier)
    await refreshUser()
    queryClient.invalidateQueries({ queryKey: ['lens-analysis'] })
  }

  // Merge a single field into one of the analyze tuning blocks (sends the whole
  // block; the API merges settings shallowly). affectsAnalysis so the shared
  // ['lens-analysis'] query refetches with the new tuning.
  function setDirection(key: keyof typeof settings.direction_thresholds, value: number) {
    update({ direction_thresholds: { ...settings.direction_thresholds, [key]: value } }, { affectsAnalysis: true })
  }
  function setVolatility(key: keyof typeof settings.volatility, value: string | number) {
    update({ volatility: { ...settings.volatility, [key]: value } }, { affectsAnalysis: true })
  }
  function setSignal(key: keyof typeof settings.lens_signals, value: number) {
    update({ lens_signals: { ...settings.lens_signals, [key]: value } }, { affectsAnalysis: true })
  }
  function setMonteCarlo(key: keyof typeof settings.monte_carlo, value: string | number) {
    update({ monte_carlo: { ...settings.monte_carlo, [key]: value } }, { affectsAnalysis: true })
  }

  function addPosition(p: Position) {
    // Persisted to the server + query-invalidated by the manager.
    manager.addPosition(p)
    setModalOpen(false)
  }

  function removeSelected() {
    if (!selected) return
    manager.removePosition(selected)
    setSelected(null)
  }

  const selectedPosition = positions.find((p) => p.ticker === selected) ?? null

  async function editShares(ticker: string, shares: number) {
    // Persisted to the server (PATCH, recomputes equity) + query-invalidated.
    await manager.updateShares(ticker, shares)
  }

  async function handleClearData() {
    // Wipe the server-stored positions, risk tier, and dashboard layout, then drop
    // any cached analysis and send the user back through onboarding as a true
    // no-info account (Dashboard also redirects once positions are gone). Everything
    // is server-side now, so there are no cookies to clear.
    await Promise.all([
      positionsApi.replacePositions([]).catch(() => {}),
      settingsApi.setRiskTier(null).catch(() => {}),
      settingsApi.updateSettings({ layout: null }).catch(() => {}),
    ])
    await refreshUser()
    queryClient.removeQueries({ queryKey: ['lens-analysis'] })
    queryClient.invalidateQueries({ queryKey: ['positions'] })
    navigate('/onboard', { replace: true })
  }

  async function handleManageBilling() {
    setPortalLoading(true)
    setBillingError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/stripe/portal`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json()) as { success: boolean; url?: string; message?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.message ?? 'Failed to open billing portal')
      }
      window.location.href = data.url
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Something went wrong')
      setPortalLoading(false)
    }
  }

  async function handleUpgrade() {
    setPortalLoading(true)
    setBillingError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/stripe/create-checkout-session`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json()) as { success: boolean; url?: string; message?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.message ?? 'Failed to start checkout')
      }
      window.location.href = data.url
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Something went wrong')
      setPortalLoading(false)
    }
  }

  return (
    <AppShell>
      <PageHeader title="Settings" breadcrumb="Lens / Settings" />

      <div className="space-y-8">
        <Section title="General">
          <div className="space-y-4">
            <Dropdown
              label="Theme"
              options={['Dark', 'Light']}
              value={theme === 'light' ? 'Light' : 'Dark'}
              onChange={(v) => setTheme(v === 'Light' ? 'light' : 'dark')}
            />
            <Dropdown
              label="Date Format"
              options={[...DATE_FORMATS]}
              value={settings.date_format}
              onChange={(v) => update({ date_format: v })}
            />
          </div>
        </Section>

        <Section title="Investment Style">
          <RiskProfileCards value={risk} onChange={changeRisk} />
        </Section>

        <Section title="Subscription">
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
        </Section>

        <Collapsible title="Data & Refresh">
          <p className="mb-4">
            Clears all locally stored data (positions, risk profile, and dashboard
            layout) and restarts onboarding. This does not affect your account.
          </p>
          {clearConfirm ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-primary">Clear all local data and re-run onboarding?</span>
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
        </Collapsible>
        <Collapsible title="Portfolio Direction Thresholds">
          <p className="mb-4">
            Slope cutoffs (fraction per period) that classify a holding's direction.
          </p>
          <div className="space-y-3">
            <NumberRow label="Strong" step={0.01} value={settings.direction_thresholds.strong} onCommit={(v) => setDirection('strong', v)} />
            <NumberRow label="Steady" step={0.01} value={settings.direction_thresholds.steady} onCommit={(v) => setDirection('steady', v)} />
            <NumberRow label="Neutral (high)" step={0.01} value={settings.direction_thresholds.neutral_high} onCommit={(v) => setDirection('neutral_high', v)} />
            <NumberRow label="Neutral (low)" step={0.01} value={settings.direction_thresholds.neutral_low} onCommit={(v) => setDirection('neutral_low', v)} />
            <NumberRow label="Depreciating" step={0.01} value={settings.direction_thresholds.depreciating} onCommit={(v) => setDirection('depreciating', v)} />
          </div>
          <div className="mt-4">
            <Button variant="ghost" onClick={() => update({ direction_thresholds: DEFAULT_USER_SETTINGS.direction_thresholds }, { affectsAnalysis: true })}>
              Reset to defaults
            </Button>
          </div>
        </Collapsible>

        <Collapsible title="Volatility">
          <p className="mb-4">Lookback window and the low/high annualized-volatility cutoffs (%).</p>
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
          <div className="mt-4">
            <Button variant="ghost" onClick={() => update({ volatility: DEFAULT_USER_SETTINGS.volatility }, { affectsAnalysis: true })}>
              Reset to defaults
            </Button>
          </div>
        </Collapsible>

        <Collapsible title="Lens Signal Thresholds">
          <p className="mb-4">The trigger levels the Lens engine uses to flag risks.</p>
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
          <div className="mt-4">
            <Button variant="ghost" onClick={() => update({ lens_signals: DEFAULT_USER_SETTINGS.lens_signals }, { affectsAnalysis: true })}>
              Reset to defaults
            </Button>
          </div>
        </Collapsible>

        <Collapsible title="Monte Carlo">
          <p className="mb-4">Projection horizon and number of simulated paths.</p>
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
          <div className="mt-4">
            <Button variant="ghost" onClick={() => update({ monte_carlo: DEFAULT_USER_SETTINGS.monte_carlo }, { affectsAnalysis: true })}>
              Reset to defaults
            </Button>
          </div>
        </Collapsible>

        <Collapsible title="Developer" />

        <Section title="Positions">
          {positions.length === 0 ? (
            <p className="text-sm text-muted">No positions stored.</p>
          ) : (
            <div className="space-y-2">
              {positions.map((p) => (
                <button
                  key={p.ticker}
                  type="button"
                  onClick={() => setSelected((s) => (s === p.ticker ? null : p.ticker))}
                  className={cn(
                    'flex w-full items-center rounded-md border px-4 py-3 text-left text-sm transition-all duration-200 ease-out',
                    selected === p.ticker
                      ? 'border-accent-teal bg-accent-teal/5'
                      : 'border-subtle hover:border-accent-teal/40',
                  )}
                >
                  <span className="text-secondary">
                    {p.ticker} · {p.shares} shares
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="teal" onClick={() => setModalOpen(true)}>
              Add New Position (a)
            </Button>
            <Button variant="red" onClick={removeSelected} disabled={!selected}>
              Remove Selected Position
            </Button>
            <Button variant="ghost" onClick={() => setEditOpen(true)} disabled={!selected}>
              Edit Selected Holding
            </Button>
          </div>
        </Section>

        <Section title="About">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-secondary">App Version</span>
              <span className="text-[12px] text-secondary">
                v{__APP_VERSION__} · API {apiStatus}
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
        </Section>
      </div>

      {modalOpen && (
        <AddPositionModal onClose={() => setModalOpen(false)} onAdd={addPosition} />
      )}
      {editOpen && selectedPosition && (
        <EditPositionModal
          position={selectedPosition}
          onClose={() => setEditOpen(false)}
          onSave={editShares}
        />
      )}
    </AppShell>
  )
}
