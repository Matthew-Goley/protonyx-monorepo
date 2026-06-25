import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Tab = 'signin' | 'signup'

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-secondary">{label}</label>
      <Input {...props} />
    </div>
  )
}

export function Login() {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('signin')

  // Sign in
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)

  // Sign up
  const [suUsername, setSuUsername] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPassword, setSuPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signup(suUsername, suEmail, suPassword)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setSubmitting(false)
    }
  }

  function switchTab(next: Tab) {
    setTab(next)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-base px-4">
      <div className="mx-auto mt-24 w-full max-w-md">
        <div className="text-center">
          <h1 className="text-gradient text-4xl font-extrabold">Lens</h1>
          <p className="mt-2 text-secondary">Portfolio intelligence, clearly explained.</p>
        </div>

        <div className="mt-10 flex border-b border-subtle">
          {(['signin', 'signup'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={cn(
                'flex-1 border-b-2 pb-3 text-sm font-medium transition-colors',
                tab === t
                  ? 'border-accent-teal text-primary'
                  : 'border-transparent text-muted hover:text-secondary',
              )}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {tab === 'signin' ? (
          <form onSubmit={handleSignIn} className="mt-8 space-y-5">
            <Field
              label="Username or email"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={submitting}
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-secondary">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-subtle bg-base accent-accent-teal"
                />
                Remember me
              </label>
              <a href="#" className="text-accent-teal hover:underline">
                Forgot password?
              </a>
            </div>
            {error && (
              <p className="rounded-lg bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
                {error}
              </p>
            )}
            <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="mt-8 space-y-5">
            <Field
              label="Username"
              type="text"
              value={suUsername}
              onChange={(e) => setSuUsername(e.target.value)}
              required
              disabled={submitting}
            />
            <Field
              label="Email"
              type="email"
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              required
              disabled={submitting}
            />
            <Field
              label="Password"
              type="password"
              value={suPassword}
              onChange={(e) => setSuPassword(e.target.value)}
              required
              disabled={submitting}
            />
            {error && (
              <p className="rounded-lg bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
                {error}
              </p>
            )}
            <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create Account'}
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              By signing up you agree to our{' '}
              <a href="#" className="text-accent-teal hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-accent-teal hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
