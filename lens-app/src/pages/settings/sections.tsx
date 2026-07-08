import {
  Settings2,
  SlidersHorizontal,
  CreditCard,
  TrendingUp,
  Activity,
  Radar,
  Dices,
  RotateCcw,
  Info,
  type LucideIcon,
} from 'lucide-react'
import { type ReactNode } from 'react'
import {
  GeneralControls,
  InvestmentStyleControls,
  SubscriptionControls,
  DataResetControls,
  AboutControls,
  DirectionThresholdsControls,
  VolatilityControls,
  LensSignalsControls,
  MonteCarloControls,
} from './parts'
import { type SettingsController } from './useSettingsController'

export interface SettingsSection {
  id: string
  title: string
  group: string
  icon: LucideIcon
  render: (ctrl: SettingsController) => ReactNode
}

/**
 * The non-positions settings sections, tagged with a category group + icon. The
 * nav / tab / accordion designs iterate this so adding a future setting is a
 * one-line append here, not a page rewrite. Positions is handled separately by
 * every design (it is the headline action, not just another section).
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'style', title: 'Investment Style', group: 'Portfolio', icon: SlidersHorizontal, render: (c) => <InvestmentStyleControls ctrl={c} /> },
  { id: 'general', title: 'General', group: 'Preferences', icon: Settings2, render: (c) => <GeneralControls ctrl={c} /> },
  { id: 'subscription', title: 'Subscription', group: 'Account', icon: CreditCard, render: (c) => <SubscriptionControls ctrl={c} /> },
  { id: 'direction', title: 'Portfolio Direction Thresholds', group: 'Engine Tuning', icon: TrendingUp, render: (c) => <DirectionThresholdsControls ctrl={c} /> },
  { id: 'volatility', title: 'Volatility', group: 'Engine Tuning', icon: Activity, render: (c) => <VolatilityControls ctrl={c} /> },
  { id: 'signals', title: 'Lens Signal Thresholds', group: 'Engine Tuning', icon: Radar, render: (c) => <LensSignalsControls ctrl={c} /> },
  { id: 'montecarlo', title: 'Monte Carlo', group: 'Engine Tuning', icon: Dices, render: (c) => <MonteCarloControls ctrl={c} /> },
  { id: 'data', title: 'Data & Reset', group: 'Account', icon: RotateCcw, render: (c) => <DataResetControls ctrl={c} /> },
  { id: 'about', title: 'About', group: 'Account', icon: Info, render: (c) => <AboutControls ctrl={c} /> },
]

/** Distinct groups, in first-seen order. */
export const SETTINGS_GROUPS = SETTINGS_SECTIONS.reduce<string[]>((acc, s) => {
  if (!acc.includes(s.group)) acc.push(s.group)
  return acc
}, [])
