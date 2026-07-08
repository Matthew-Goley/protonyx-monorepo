import { useState } from 'react'
import { Wallet, type LucideIcon } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel } from '@/components/common/Panel'
import { cn } from '@/lib/utils'
import { useSettingsController } from './settings/useSettingsController'
import { PositionsManagerPanel } from './settings/parts'
import { SETTINGS_SECTIONS, type SettingsSection } from './settings/sections'

/**
 * Settings - a secondary vertical nav (master / detail): categories on the left,
 * one content pane on the right so nothing sprawls horizontally. "Positions" is the
 * first nav item and the default view, so managing holdings is the headline action.
 * New settings are just new rows in SETTINGS_SECTIONS (src/pages/settings/sections.tsx).
 */
interface NavItem {
  id: string
  title: string
  icon: LucideIcon
}

export function Settings() {
  const ctrl = useSettingsController()
  const [active, setActive] = useState('positions')

  // Group the sections, then slot Positions in as the first Portfolio item.
  const groups: { group: string; items: NavItem[] }[] = []
  const byId = new Map<string, SettingsSection>()
  for (const s of SETTINGS_SECTIONS) {
    byId.set(s.id, s)
    let g = groups.find((x) => x.group === s.group)
    if (!g) {
      g = { group: s.group, items: [] }
      groups.push(g)
    }
    g.items.push({ id: s.id, title: s.title, icon: s.icon })
  }
  const portfolio = groups.find((g) => g.group === 'Portfolio')
  if (portfolio) portfolio.items.unshift({ id: 'positions', title: 'Positions', icon: Wallet })

  const activeSection = byId.get(active)

  return (
    <AppShell>
      <PageHeader title="Settings" breadcrumb="Lens / Settings" />
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Nav rail */}
        <nav className="w-full shrink-0 lg:w-60">
          <div className="space-y-6 lg:sticky lg:top-[5.5rem]">
            {groups.map((g) => (
              <div key={g.group}>
                <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-secondary">
                  {g.group}
                </p>
                <div className="space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon
                    const on = active === it.id
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => setActive(it.id)}
                        className={cn(
                          'relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-all duration-200 ease-out',
                          on
                            ? 'bg-card-hover font-medium text-primary'
                            : 'text-secondary hover:bg-card hover:text-primary',
                        )}
                      >
                        {on && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-brand" />
                        )}
                        <Icon size={16} className={cn(on ? 'text-accent-teal' : 'text-secondary')} />
                        <span className="truncate">{it.title}</span>
                        {it.id === 'positions' && (
                          <span className="ml-auto rounded-full bg-base px-1.5 py-0.5 text-[10px] text-secondary">
                            {ctrl.positions.length}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Detail pane */}
        <div className="min-w-0 flex-1">
          {active === 'positions' ? (
            <Panel className="flex max-h-[70vh] flex-col">
              <h3 className="mb-4 text-xl font-semibold text-primary">Positions</h3>
              <PositionsManagerPanel ctrl={ctrl} heightClass="max-h-none" />
            </Panel>
          ) : activeSection ? (
            <Panel>
              <h3 className="mb-4 text-xl font-semibold text-primary">{activeSection.title}</h3>
              {activeSection.render(ctrl)}
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
