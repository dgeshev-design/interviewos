import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { saveGoogleToken } from '@/lib/api'

const AppContext = createContext(null)

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_DOMAINS || 'betty.com')
  .split(',').map(d => d.trim().toLowerCase())

function getEmailDomain(email) { return email?.split('@')[1]?.toLowerCase() || '' }

export function AppProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [isMaster, setIsMaster]   = useState(false)
  const [loading, setLoading]     = useState(true)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleUser(session.user, session)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) handleUser(session.user, session)
      else { setUser(null); setWorkspace(null); setIsMaster(false); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleUser(u, session) {
    const emailDomain = getEmailDomain(u.email)
    if (!ALLOWED_DOMAINS.includes(emailDomain)) {
      await supabase.auth.signOut()
      setAuthError('Access restricted to betty.com domains.')
      setLoading(false)
      return
    }
    setUser(u)
    const ws = await resolveWorkspace(u)
    if (ws && session?.provider_token) {
      try {
        await saveGoogleToken({
          workspaceId:  ws.id,
          userId:       u.id,
          accessToken:  session.provider_token,
          refreshToken: session.provider_refresh_token || null,
          expiresIn:    3600,
          email:        u.email,
        })
      } catch {}
    }
    setLoading(false)
  }

  async function resolveWorkspace(u) {
    const hostname    = window.location.hostname
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
    const emailDomain = getEmailDomain(u.email)

    async function lookupByDomain(domain) {
      const { data: dr } = await supabase
        .from('workspace_domains')
        .select('workspace_id, is_master')
        .eq('domain', domain)
        .maybeSingle()
      if (!dr?.workspace_id) return null
      const { data: ws } = await supabase
        .from('workspaces').select('*').eq('id', dr.workspace_id).single()
      if (!ws) return null
      setWorkspace(ws)
      setIsMaster(!!dr.is_master)
      return ws
    }

    // 1. Try hostname first (only on real domains, not localhost)
    if (!isLocalhost) {
      const ws = await lookupByDomain(hostname)
      if (ws) return ws
    }

    // 2. Try email domain — works on localhost and as fallback on prod
    //    This is the key: all users with same email domain share a workspace
    const ws2 = await lookupByDomain(emailDomain)
    if (ws2) return ws2

    // 3. Create a new workspace (first user for this email domain)
    //    and register the email domain so future users auto-join
    const name = u.user_metadata?.full_name
      ? `${u.user_metadata.full_name}'s Workspace`
      : `${emailDomain} Workspace`
    const { data: created, error } = await supabase
      .from('workspaces').insert({ user_id: u.id, name }).select().single()
    if (!error && created) {
      await supabase.from('workspace_domains').insert({
        workspace_id: created.id,
        domain:       emailDomain,
        is_master:    true,
      })
      setWorkspace(created)
      setIsMaster(true)
      return created
    }
    setWorkspace(null)
    return null
  }

  async function signInWithGoogle() {
    setAuthError(null)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setWorkspace(null); setIsMaster(false)
  }

  return (
    <AppContext.Provider value={{ user, workspace, isMaster, loading, authError, signInWithGoogle, signOut }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
