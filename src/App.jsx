import { Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from '@/context/AppContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Participants from '@/pages/Participants'
import IntakeForm from '@/pages/IntakeForm'
import InterviewGuide from '@/pages/InterviewGuide'
import CommsHub from '@/pages/CommsHub'

function AuthGuard({ children }) {
  const { user, authLoading } = useApp()

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-body)', fontSize: 14, background: 'var(--bg-base)'
      }}>
        Loading…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { user, authLoading } = useApp()

  if (authLoading) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <AuthGuard>
          <Layout>
            <Routes>
              <Route path="/"             element={<Dashboard />}     />
              <Route path="/participants" element={<Participants />}   />
              <Route path="/form"         element={<IntakeForm />}     />
              <Route path="/guide"        element={<InterviewGuide />} />
              <Route path="/comms"        element={<CommsHub />}       />
              <Route path="*"             element={<Navigate to="/" />} />
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
    </AppProvider>
  )
}
