import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/common/Panel'

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/** Stripe paywall. Hits POST /stripe/create-checkout-session and redirects to
 *  Stripe Checkout. Shown wherever analysis data is gated behind a subscription. */
export function UpgradePrompt() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
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
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <Panel className="mx-auto max-w-md p-8">
      <span className="inline-flex rounded-full border border-accent-teal/30 bg-accent-teal/10 px-3 py-1 text-xs font-medium text-accent-teal">
        Lens Pro
      </span>
      <h2 className="mt-4 text-2xl font-bold text-primary">Upgrade to unlock analytics</h2>
      <p className="mt-2 text-sm leading-relaxed text-secondary">
        Lens portfolio analytics requires an active subscription. Get the full brief,
        caution score, projections and actionable buy / sell / hold guidance.
      </p>

      <div className="mt-6 rounded-xl border border-subtle bg-base p-5">
        <p className="text-3xl font-bold text-primary">
          $10 <span className="text-base font-normal text-muted">/ month</span>
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-secondary">
          <li>Full portfolio analysis</li>
          <li>Actionable buy / sell / hold projections</li>
          <li>Caution score and risk breakdown</li>
        </ul>
      </div>

      {error && <p className="mt-4 text-sm text-accent-red">{error}</p>}

      <Button
        variant="gradient"
        onClick={handleUpgrade}
        disabled={loading}
        className="mt-5 w-full"
      >
        {loading ? 'Redirecting to checkout...' : 'Upgrade - $10 / month'}
      </Button>
    </Panel>
  )
}
