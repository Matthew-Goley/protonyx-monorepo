import { useLocation, useNavigate } from 'react-router-dom'
import { type LensResult } from '@/api/lens'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function Results() {
  const location = useLocation()
  const navigate = useNavigate()
  const result = (location.state as { result?: LensResult } | null)?.result

  if (!result) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-muted-foreground">No analysis result. Run an analysis first.</p>
          <Button onClick={() => navigate('/portfolio')}>Analyze Portfolio</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Results</h1>
          <Button variant="outline" onClick={() => navigate('/portfolio')}>
            New Analysis
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Brief</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{result.brief}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Caution Score</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <span className="text-6xl font-bold tabular-nums" style={{ color: result.color }}>
              {result.caution_score}
            </span>
            <div className="space-y-1 text-sm">
              <p>
                Action:{' '}
                <span className="font-medium">{result.action_type.replace(/_/g, ' ')}</span>
              </p>
              <p>
                Net delta:{' '}
                <span className="font-medium">
                  {result.net_cta_delta >= 0 ? '+' : ''}${result.net_cta_delta.toFixed(2)}
                </span>
              </p>
              {result.recommended_tickers.length > 0 && (
                <p>
                  Recommended:{' '}
                  <span className="font-medium">{result.recommended_tickers.join(', ')}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {result.ctas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recommended Actions ({result.ctas.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.ctas.map((cta, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border rounded-md p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge style={{ backgroundColor: result.color, color: '#fff', border: 'none' }}>
                      {cta.action.replace(/_/g, ' ')}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{cta.ticker}</p>
                      <p className="text-xs text-muted-foreground">{cta.sector}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">${cta.dollars.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{cta.severity}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
