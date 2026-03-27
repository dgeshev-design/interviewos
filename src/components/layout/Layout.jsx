import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50/40">
      <Sidebar />
      <main className="ml-[220px] flex-1 min-h-screen">
        {children}
      </main>
    </div>
  )
}
