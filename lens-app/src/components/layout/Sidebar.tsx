import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  BarChart2,
  User,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
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
    <aside className="fixed inset-y-0 left-0 flex w-[220px] flex-col border-r border-subtle bg-sidebar">
      <div className="px-6 pt-6 pb-8">
        <span className="text-gradient text-2xl font-bold">Lens</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent-teal/10 font-medium text-accent-teal'
                  : 'text-secondary hover:bg-card hover:text-primary',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-6">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-card hover:text-accent-red"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  )
}
