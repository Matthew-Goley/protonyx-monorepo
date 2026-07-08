import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { isSubscribed } from '@/lib/subscription'
import { lensApi, type Position } from '@/api/lens'
import { positionsApi } from '@/api/positions'
import { settingsApi, DEFAULT_USER_SETTINGS, type RiskTier } from '@/api/settings'
import { usePositionsManager } from '@/hooks/usePositionsManager'
import { useUserSettings } from '@/hooks/useUserSettings'
import { useHotkey } from '@/hooks/useHotkey'
import { BACKEND_URL } from '@/lib/backend'

/**
 * All Settings state + handlers, lifted out of the page so the five candidate
 * layout designs can each consume the exact same behavior and only differ in
 * presentation. This is the single source of truth every settings variant reads.
 */
export function useSettingsController() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const pro = isSubscribed(user)

  const manager = usePositionsManager()
  const positions = manager.positions
  const { settings, update } = useUserSettings()

  const [risk, setRisk] = useState<RiskTier>(user?.risk_tier ?? 'regular')
  const [selected, setSelected] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const [clearConfirm, setClearConfirm] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<string>('checking...')

  // Press "a" to open the add-position modal (matches Onboard + the dashboard).
  useHotkey('a', () => setModalOpen(true), !modalOpen && !editOpen)

  useEffect(() => {
    lensApi
      .health()
      .then((h) => setApiStatus(h.status))
      .catch(() => setApiStatus('unavailable'))
  }, [])

  useEffect(() => {
    if (user?.risk_tier) setRisk(user.risk_tier)
  }, [user?.risk_tier])

  async function changeRisk(tier: RiskTier) {
    setRisk(tier)
    await settingsApi.setRiskTier(tier)
    await refreshUser()
    queryClient.invalidateQueries({ queryKey: ['lens-analysis'] })
  }

  function setDirection(key: keyof typeof settings.direction_thresholds, value: number) {
    update(
      { direction_thresholds: { ...settings.direction_thresholds, [key]: value } },
      { affectsAnalysis: true },
    )
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

  function resetDirection() {
    update({ direction_thresholds: DEFAULT_USER_SETTINGS.direction_thresholds }, { affectsAnalysis: true })
  }
  function resetVolatility() {
    update({ volatility: DEFAULT_USER_SETTINGS.volatility }, { affectsAnalysis: true })
  }
  function resetSignals() {
    update({ lens_signals: DEFAULT_USER_SETTINGS.lens_signals }, { affectsAnalysis: true })
  }
  function resetMonteCarlo() {
    update({ monte_carlo: DEFAULT_USER_SETTINGS.monte_carlo }, { affectsAnalysis: true })
  }

  function addPosition(p: Position) {
    manager.addPosition(p)
    setModalOpen(false)
  }

  function removeSelected() {
    if (!selected) return
    manager.removePosition(selected)
    setSelected(null)
  }

  function removeTicker(ticker: string) {
    manager.removePosition(ticker)
    if (selected === ticker) setSelected(null)
  }

  const selectedPosition = positions.find((p) => p.ticker === selected) ?? null

  async function editShares(ticker: string, shares: number) {
    await manager.updateShares(ticker, shares)
  }

  async function handleClearData() {
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

  return {
    // positions
    manager,
    positions,
    selected,
    setSelected,
    modalOpen,
    setModalOpen,
    editOpen,
    setEditOpen,
    selectedPosition,
    addPosition,
    removeSelected,
    removeTicker,
    editShares,
    // general
    theme,
    setTheme,
    settings,
    update,
    // risk
    risk,
    changeRisk,
    // subscription
    pro,
    portalLoading,
    billingError,
    handleManageBilling,
    handleUpgrade,
    // data
    clearConfirm,
    setClearConfirm,
    handleClearData,
    // tuning
    setDirection,
    setVolatility,
    setSignal,
    setMonteCarlo,
    resetDirection,
    resetVolatility,
    resetSignals,
    resetMonteCarlo,
    // about
    apiStatus,
  }
}

export type SettingsController = ReturnType<typeof useSettingsController>
