import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'

export function Success() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-8">
      <div className="max-w-sm space-y-4 text-center">
        <div className="bg-gradient-brand mx-auto flex h-16 w-16 items-center justify-center rounded-full">
          <Check size={32} className="text-base" />
        </div>
        <h1 className="text-2xl font-bold text-primary">Subscription active</h1>
        <p className="text-secondary">
          Welcome to Lens Pro. Redirecting to your dashboard in a moment.
        </p>
      </div>
    </div>
  )
}
