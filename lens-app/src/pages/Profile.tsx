import { useAuth } from '@/contexts/AuthContext'
import { isSubscribed } from '@/lib/subscription'
import { useLensAnalysis } from '@/hooks/useLensAnalysis'
import { getPositions } from '@/lib/cookies'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel } from '@/components/common/Panel'
import { totalEquity, formatCurrency } from '@/lib/lensData'

function PlanBadge({ pro }: { pro: boolean }) {
  return pro ? (
    <span className="rounded-full border border-accent-teal/30 bg-accent-teal/10 px-3 py-1 text-xs font-medium text-accent-teal">
      Pro
    </span>
  ) : (
    <span className="rounded-full border border-subtle px-3 py-1 text-xs font-medium text-secondary">
      Free
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-subtle py-4 last:border-b-0">
      <span className="text-[13px] font-medium uppercase tracking-wider text-secondary">{label}</span>
      <span className="text-sm text-primary">{value}</span>
    </div>
  )
}

export function Profile() {
  const { user } = useAuth()
  const hasPositions = getPositions().length > 0
  const query = useLensAnalysis()

  const pro = isSubscribed(user)
  const initial = (user?.username ?? 'U').charAt(0).toUpperCase()
  const memberSince = user?.member_since
    ? new Date(user.member_since).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '--'

  const equity =
    hasPositions && query.data ? formatCurrency(totalEquity(query.data)) : '--'

  return (
    <AppShell>
      <PageHeader title="Profile" breadcrumb="Lens / Profile" />

      <Panel className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-teal/20 text-xl font-semibold text-accent-teal">
            {initial}
          </div>
          <div>
            <p className="text-xl font-semibold text-primary">{user?.username ?? 'User'}</p>
            <p className="text-sm text-secondary">Member since {memberSince}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[28px] font-semibold tracking-[-0.02em] text-primary">{equity}</p>
          <p className="text-xs text-secondary">Total equity</p>
        </div>
      </Panel>

      <Panel className="px-6 py-2">
        <InfoRow label="Username" value={user?.username ?? '--'} />
        <InfoRow label="Email" value={user?.email ?? '--'} />
        <InfoRow label="Plan" value={<PlanBadge pro={pro} />} />
        <InfoRow label="Member Since" value={memberSince} />
        <InfoRow
          label="Beta Access"
          value={user?.beta_access ? 'Enabled' : 'Not enabled'}
        />
      </Panel>
    </AppShell>
  )
}
