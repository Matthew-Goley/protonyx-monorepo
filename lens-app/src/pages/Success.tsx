import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { Logo } from '@/components/common/Logo'

export function Success() {
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => navigate('/dashboard', { replace: true }), 3000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-base p-8">
      <div className="flex max-w-sm flex-col items-center space-y-4 text-center">
        <Logo variant="full" className="mb-2 h-7 w-auto" />
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
