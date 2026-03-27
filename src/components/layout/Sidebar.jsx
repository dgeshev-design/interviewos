import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, BookOpen, Settings, LogOut } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/calendar',icon: CalendarDays,    label: 'Calendar'   },
  { to: '/studies', icon: BookOpen,        label: 'Studies'    },
  { to: '/settings',icon: Settings,        label: 'Settings'   },
]

export default function Sidebar() {
  const { user, workspace, signOut } = useApp()
  const loc = useLocation()

  const initials = user?.user_metadata?.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-[220px] flex flex-col border-r bg-white">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b">
        <span className="font-semibold text-[15px] tracking-tight text-foreground">
          Interview<span className="text-brand-500">OS</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
