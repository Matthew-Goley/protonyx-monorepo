import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function Success() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">ok</div>
        <h1 className="text-2xl font-bold">Subscription active</h1>
        <p className="text-muted-foreground">
          Welcome to Lens Pro. Redirecting to your dashboard in a moment.
        </p>
      </div>
    </div>
  )
}
