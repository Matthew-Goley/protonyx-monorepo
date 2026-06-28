import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BarChart2,
  User,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/common/Logo'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analysis', label: 'Analysis', icon: BarChart2 },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function Sidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[220px] flex-col border-r border-subtle bg-sidebar">
      <div className="px-6 pt-6 pb-8">
        <Logo variant="full" className="h-7 w-auto" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200 ease-out',
                isActive
                  ? 'bg-accent-teal/10 font-medium text-accent-teal'
                  : 'text-secondary hover:bg-card hover:text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active nav indicator: 2px vertical brand-gradient bar on the
                    left edge (styling.md §Gradient Hairlines). */}
                {isActive && (
                  <span
                    aria-hidden
                    className="bg-gradient-brand absolute inset-y-2 left-0 w-0.5 rounded-r-sm"
                  />
                )}
                <Icon size={18} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-6">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted transition-all duration-200 ease-out hover:bg-card hover:text-accent-red"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  )
}
