import { AppSidebar } from './Sidebar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

export default function Layout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 min-h-screen bg-gray-50/40">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
