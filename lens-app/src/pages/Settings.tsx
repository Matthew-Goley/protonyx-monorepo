import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  cancelled: 'Cancelled',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  cancelled: 'destructive',
}

export function Settings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  const status = user?.subscription_status ?? 'inactive'

  async function handleManageBilling() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/stripe/portal`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json() as { success: boolean; url?: string; message?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.message ?? 'Failed to open billing portal')
      }
      window.location.href = data.url
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Something went wrong')
      setPortalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            Back
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Your current Lens Pro subscription status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>
                {STATUS_LABEL[status] ?? status}
              </Badge>
            </div>
            {status === 'active' && (
              <>
                {portalError && <p className="text-sm text-destructive">{portalError}</p>}
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="w-full"
                >
                  {portalLoading ? 'Opening billing portal...' : 'Manage Billing'}
                </Button>
              </>
            )}
            {status !== 'active' && (
              <Button onClick={() => navigate('/portfolio')} className="w-full">
                Upgrade to Lens Pro
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis Settings</CardTitle>
            <CardDescription>Risk tier and analysis preferences - coming soon.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No settings implemented yet.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
