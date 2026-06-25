import { type RiskTier } from '@/lib/cookies'
import { cn } from '@/lib/utils'

interface Option {
  tier: RiskTier
  title: string
  subtitle: string
  description: string
}

const OPTIONS: Option[] = [
  {
    tier: 'low',
    title: 'Conservative',
    subtitle: 'Stability first',
    description: 'Flags risks early. Tighter thresholds, quicker action suggestions.',
  },
  {
    tier: 'regular',
    title: 'Moderate',
    subtitle: 'Balanced approach',
    description: 'Standard thresholds. Flags meaningful risks while riding out normal swings.',
  },
  {
    tier: 'high',
    title: 'Aggressive',
    subtitle: 'Growth focused',
    description: 'Wide tolerance. Only flags serious risks, suited for high-swing portfolios.',
  },
]

export function RiskProfileCards({
  value,
  onChange,
}: {
  value: RiskTier | null
  onChange: (tier: RiskTier) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {OPTIONS.map((opt) => {
        const selected = value === opt.tier
        return (
          <button
            key={opt.tier}
            type="button"
            onClick={() => onChange(opt.tier)}
            className={cn(
              'rounded-xl border-2 p-6 text-left transition-colors',
              selected
                ? 'border-accent-teal bg-accent-teal/5'
                : 'border-subtle hover:border-accent-teal/50',
            )}
          >
            <p className="text-base font-bold text-primary">{opt.title}</p>
            <p className="mt-0.5 text-sm font-medium text-accent-teal">{opt.subtitle}</p>
            <p className="mt-3 text-sm leading-relaxed text-secondary">{opt.description}</p>
          </button>
        )
      })}
    </div>
  )
}
