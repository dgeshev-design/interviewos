import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { saveGoogleToken } from '@/lib/api'

const AppContext = createContext(null)

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_DOMAINS || 'betty.com')
  .split(',').map(d => d.trim().toLowerCase())

function getDomain(email) { return email?.split('@')[1]?.toLowerCase() || '' }

export function AppProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleUser(session.user, session)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) handleUser(session.user, session)
      else { setUser(null); setWorkspace(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleUser(u, session) {
    const domain = getDomain(u.email)
    if (!ALLOWED_DOMAINS.includes(domain)) {
      await supabase.auth.signOut()
      setAuthError(`Access restricted to betty.com domains.`)
      setLoading(false)
      return
    }
    setUser(u)
    const ws = await ensureWorkspace(u)
    if (ws && session?.provider_token) {
      try {
        await saveGoogleToken({
          workspaceId:  ws.id,
          accessToken:  session.provider_token,
          refreshToken: session.provider_refresh_token || null,
          expiresIn:    3600,
          email:        u.email,
        })
      } catch {}
    }
    setLoading(false)
  }

  async function ensureWorkspace(u) {
    let { data, error } = await supabase
      .from('workspaces').select('*').eq('user_id', u.id).single()
    if (error?.code === 'PGRST116') {
      const name = u.user_metadata?.full_name
        ? `${u.user_metadata.full_name}'s Workspace`
        : 'My Workspace'
      const { data: created } = await supabase
        .from('workspaces').insert({ user_id: u.id, name }).select().single()
      data = created
    }
    setWorkspace(data)
    return data
  }

  async function signInWithGoogle() {
    setAuthError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent' }
      }
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setWorkspace(null)
  }

  return (
    <AppContext.Provider value={{ user, workspace, loading, authError, signInWithGoogle, signOut }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
