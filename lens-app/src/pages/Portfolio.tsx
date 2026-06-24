import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { lensApi, type Position } from '@/api/lens'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const EXAMPLE: Position[] = [
  {
    ticker: 'AAPL',
    shares: 10,
    equity: 1950,
    price: 195,
    sector: 'Technology',
    name: 'Apple Inc.',
    added_at: '2024-01-01T00:00:00',
  },
  {
    ticker: 'JNJ',
    shares: 8,
    equity: 1120,
    price: 140,
    sector: 'Healthcare',
    name: 'Johnson & Johnson',
    added_at: '2024-01-01T00:00:00',
  },
  {
    ticker: 'JPM',
    shares: 5,
    equity: 1050,
    price: 210,
    sector: 'Financial Services',
    name: 'JPMorgan Chase',
    added_at: '2024-01-01T00:00:00',
  },
]

function UpgradePrompt() {
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
      const data = await res.json() as { success: boolean; url?: string; message?: string }
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
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Upgrade to Lens Pro</CardTitle>
          <CardDescription>
            Lens portfolio analytics requires an active subscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-1">
            <p className="font-semibold">Lens Pro</p>
            <p className="text-2xl font-bold">$10 <span className="text-base font-normal text-muted-foreground">/ month</span></p>
            <ul className="text-sm text-muted-foreground space-y-1 pt-2">
              <li>Full portfolio analysis</li>
              <li>Actionable buy / sell / hold CTAs</li>
              <li>Caution score and risk breakdown</li>
            </ul>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleUpgrade} disabled={loading} className="w-full">
            {loading ? 'Redirecting to checkout...' : 'Upgrade - $10 / month'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function Portfolio() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [json, setJson] = useState(JSON.stringify(EXAMPLE, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (positions: Position[]) => lensApi.analyze({ positions }),
    onSuccess: (result) => {
      navigate('/results', { state: { result } })
    },
  })

  if (user?.subscription_status !== 'active') {
    return <UpgradePrompt />
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setParseError(null)
    let positions: Position[]
    try {
      const parsed: unknown = JSON.parse(json)
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array of positions')
      positions = parsed as Position[]
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON')
      return
    }
    mutation.mutate(positions)
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Enter Positions</h1>
        <Card>
          <CardHeader>
            <CardTitle>Portfolio JSON</CardTitle>
            <CardDescription>
              Paste positions as a JSON array. Required fields per position:{' '}
              <code className="text-xs bg-muted px-1 rounded">ticker</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">shares</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">equity</code>,{' '}
              <code className="text-xs bg-muted px-1 rounded">price</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="positions">Positions</Label>
                <Textarea
                  id="positions"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  rows={18}
                  className="font-mono text-sm"
                />
              </div>
              {parseError && <p className="text-sm text-destructive">{parseError}</p>}
              {mutation.isError && (
                <p className="text-sm text-destructive">
                  {mutation.error instanceof Error ? mutation.error.message : 'Analysis failed'}
                </p>
              )}
              <Button type="submit" disabled={mutation.isPending} className="w-full">
                {mutation.isPending ? 'Analyzing...' : 'Analyze Portfolio'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
