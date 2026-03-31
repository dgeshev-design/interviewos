import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from '@/context/AppContext'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/layout/Layout'

// Public pages — loaded immediately, no auth needed
import PublicBooking from '@/pages/PublicBooking'
import StudyReport from '@/pages/StudyReport'
import Login from '@/pages/Login'

// Internal pages — lazy loaded, only downloaded when user is authenticated
const Dashboard          = lazy(() => import('@/pages/Dashboard'))
const Calendar           = lazy(() => import('@/pages/Calendar'))
const Studies            = lazy(() => import('@/pages/Studies'))
const StudyDetail        = lazy(() => import('@/pages/StudyDetail'))
const ParticipantProfile = lazy(() => import('@/pages/ParticipantProfile'))
const Settings           = lazy(() => import('@/pages/Settings'))

const PUBLIC_PATHS = ['/s/', '/report/', '/login']

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
  const { pathname } = useLocation()

  // Don't block public routes on auth loading
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (!isPublic && loading) return null

  return (
    <Routes>
      {/* Public routes — render immediately, no auth wait */}
      <Route path="/s/:studySlug" element={<PublicBooking />} />
      <Route path="/report/:token" element={<StudyReport />} />
      <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <Login />} />

      {/* Protected routes — lazy loaded chunks */}
      <Route path="/*" element={
        <AuthGuard>
          <Layout>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/"                                             element={<Dashboard />}          />
                <Route path="/calendar"                                     element={<Calendar />}           />
                <Route path="/studies"                                      element={<Studies />}            />
                <Route path="/studies/:studyId"                             element={<StudyDetail />}        />
                <Route path="/studies/:studyId/participants/:participantId" element={<ParticipantProfile />} />
                <Route path="/settings"                                     element={<Settings />}           />
                <Route path="*"                                             element={<Navigate to="/" />}    />
              </Routes>
            </Suspense>
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
