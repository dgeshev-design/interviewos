import { useLocation } from 'react-router-dom'
import { AppSidebar } from './Sidebar'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useApp } from '@/context/AppContext'

function AppBreadcrumb() {
  const { pathname } = useLocation()
  const { studies, participants } = useApp()
  const parts = pathname.split('/').filter(Boolean)

  // Build crumb list from path segments
  const crumbs = []

  if (parts.length === 0) {
    crumbs.push({ label: 'Dashboard', href: null })
  } else if (parts[0] === 'calendar') {
    crumbs.push({ label: 'Calendar', href: null })
  } else if (parts[0] === 'settings') {
    crumbs.push({ label: 'Settings', href: null })
  } else if (parts[0] === 'studies') {
    crumbs.push({ label: 'Studies', href: parts.length > 1 ? '/studies' : null })
    if (parts[1]) {
      const study = studies?.find(s => s.id === parts[1])
      crumbs.push({ label: study?.name || '…', href: parts.length > 3 ? `/studies/${parts[1]}` : null })
    }
    if (parts[2] === 'participants' && parts[3]) {
      const participant = participants?.find(p => p.id === parts[3])
      crumbs.push({ label: participant?.name || '…', href: null })
    }
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.href
                ? <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                : <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              }
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function Layout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 sticky top-0 z-10 bg-background">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <AppBreadcrumb />
        </header>
        <main className="flex-1 min-h-screen bg-gray-50/40">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
