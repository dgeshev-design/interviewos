import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from '@/context/AppContext'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Calendar from '@/pages/Calendar'
import Studies from '@/pages/Studies'
import StudyDetail from '@/pages/StudyDetail'
import ParticipantProfile from '@/pages/ParticipantProfile'
import Settings from '@/pages/Settings'
import PublicBooking from '@/pages/PublicBooking'

function AuthGuard({ children }) {
  const { user, loading } = useApp()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground bg-gray-50">
      Loading…
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useApp()
  if (loading) return null
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/s/:studySlug" element={<PublicBooking />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      {/* Protected routes */}
      <Route path="/*" element={
        <AuthGuard>
          <Layout>
            <Routes>
              <Route path="/"                                                element={<Dashboard />}         />
              <Route path="/calendar"                                        element={<Calendar />}          />
              <Route path="/studies"                                         element={<Studies />}           />
              <Route path="/studies/:studyId"                                element={<StudyDetail />}       />
              <Route path="/studies/:studyId/participants/:participantId"    element={<ParticipantProfile />}/>
              <Route path="/settings"                                        element={<Settings />}          />
              <Route path="*"                                                element={<Navigate to="/" />}   />
            </Routes>
          </Layout>
        </AuthGuard>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
      <Toaster />
    </AppProvider>
  )
}
