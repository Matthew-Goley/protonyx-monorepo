import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { lensApi, type Position } from '@/api/lens'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

export function Portfolio() {
  const navigate = useNavigate()
  const [json, setJson] = useState(JSON.stringify(EXAMPLE, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (positions: Position[]) => lensApi.analyze({ positions }),
    onSuccess: (result) => {
      navigate('/results', { state: { result } })
    },
  })

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
