import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AppContext = createContext(null)

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_DOMAINS || 'betty.com')
  .split(',')
  .map(d => d.trim().toLowerCase())

function getDomain(email) {
  return email?.split('@')[1]?.toLowerCase() || ''
}

export function AppProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [workspace, setWorkspace]   = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError]   = useState(null)

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleUser(session.user)
      else setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) handleUser(session.user)
      else { setUser(null); setWorkspace(null); setAuthLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleUser(u) {
    const domain = getDomain(u.email)
    if (!ALLOWED_DOMAINS.includes(domain)) {
      await supabase.auth.signOut()
      setAuthError(`Access denied. Only ${ALLOWED_DOMAINS.join(', ')} emails are allowed.`)
      setAuthLoading(false)
      return
    }

    setUser(u)
    const ws = await ensureWorkspace(u)
    if (ws) await saveGoogleToken(u, ws.id)
    setAuthLoading(false)
  }

  async function ensureWorkspace(u) {
    // Get or create workspace for this user
    let { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', u.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // No workspace yet — create one
      const { data: created } = await supabase
        .from('workspaces')
        .insert({ user_id: u.id, name: u.user_metadata?.full_name ? `${u.user_metadata.full_name}'s Workspace` : 'My Workspace' })
        .select()
        .single()
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
        queryParams: {
          hd:             'betty.com',
          access_type:    'offline',   // get refresh_token
          prompt:         'consent',   // always show consent so we get refresh_token
        }
      }
    })
  }

  // Save Google token to backend after login so Calendar API can use it server-side
  async function saveGoogleToken(u, wid) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.provider_token) return

      await fetch('/api/save-google-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId:  wid,
          accessToken:  session.provider_token,
          refreshToken: session.provider_refresh_token || null,
          expiresIn:    session.expires_in || 3600,
          email:        u.email,
        }),
      })
    } catch (e) {
      console.warn('Could not save Google token:', e.message)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setWorkspace(null)
  }

  return (
    <AppContext.Provider value={{ user, workspace, authLoading, authError, signInWithGoogle, signOut }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
