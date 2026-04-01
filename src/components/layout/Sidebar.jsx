import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, CalendarDays, BookOpen, Settings, LogOut, ChevronDown, Check, ChevronsUpDown } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: CalendarDays,    label: 'Calendar'  },
  { to: '/studies',  icon: BookOpen,        label: 'Studies'   },
  { to: '/settings', icon: Settings,        label: 'Settings'  },
]

export function AppSidebar() {
  const { user, workspace, ownWorkspace, workspaces, canEdit, signOut, switchWorkspace } = useApp()
  const loc = useLocation()

  const initials = user?.user_metadata?.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  const isOwned = workspace?.id === ownWorkspace?.id

  return (
    <Sidebar>
      {/* Logo */}
      <SidebarHeader className="h-14 flex justify-center px-5 border-b">
        <span className="font-semibold text-[15px] tracking-tight">
          Interview<span className="text-brand-500">OS</span>
        </span>
      </SidebarHeader>

      <SidebarContent>
        {/* Workspace switcher */}
        {workspaces.length > 1 && (
          <SidebarGroup className="pt-3 pb-0">
            <SidebarGroupContent>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors">
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-medium truncate text-xs">{workspace?.name}</div>
                      {!isOwned && (
                        <div className="text-[10px] text-muted-foreground">
                          {canEdit ? 'Shared · Can edit' : 'Shared · View only'}
                        </div>
                      )}
                    </div>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-1" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[188px]" align="start">
                  {workspaces.map(ws => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => switchWorkspace(ws.id)}
                      className="flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-xs">{ws.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {ws.id === ownWorkspace?.id ? 'Your workspace' : (ws._memberRole === 'editor' ? 'Shared · Can edit' : 'Shared · View only')}
                        </div>
                      </div>
                      {ws.id === workspace?.id && <Check className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Nav links */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ to, icon: Icon, label }) => {
                const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)
                return (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink to={to}>
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted transition-colors">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs font-medium truncate">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[188px]">
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive gap-2">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

// Keep default export for backward compat
export default AppSidebar
