import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, BookOpen, Settings, LogOut, ChevronDown, Check } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const NAV = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/calendar',icon: CalendarDays,    label: 'Calendar'   },
  { to: '/studies', icon: BookOpen,        label: 'Studies'    },
  { to: '/settings',icon: Settings,        label: 'Settings'   },
]

export default function Sidebar() {
  const { user, workspace, ownWorkspace, workspaces, canEdit, signOut, switchWorkspace } = useApp()
  const loc = useLocation()
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const initials = user?.user_metadata?.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  const isOwned = workspace?.id === ownWorkspace?.id

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-[220px] flex flex-col border-r bg-white">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b">
        <span className="font-semibold text-[15px] tracking-tight text-foreground">
          Interview<span className="text-brand-500">OS</span>
        </span>
      </div>

      {/* Workspace switcher — shown when user has access to multiple workspaces */}
      {workspaces.length > 1 && (
        <div className="px-3 pt-3 relative">
          <button
            onClick={() => setSwitcherOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
          >
            <div className="flex-1 min-w-0 text-left">
              <div className="font-medium truncate text-xs">{workspace?.name}</div>
              {!isOwned && <div className="text-[10px] text-muted-foreground">{canEdit ? 'Shared · Can edit' : 'Shared · View only'}</div>}
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-1" />
          </button>
          {switcherOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-md border bg-white shadow-md py-1">
              {workspaces.map(ws => (
                <button
                  key={ws.id}
                  onClick={() => { switchWorkspace(ws.id); setSwitcherOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-xs">{ws.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {ws.id === ownWorkspace?.id ? 'Your workspace' : (ws._memberRole === 'editor' ? 'Shared · Can edit' : 'Shared · View only')}
                    </div>
                  </div>
                  {ws.id === workspace?.id && <Check className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
