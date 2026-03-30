import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { saveGoogleToken } from '@/lib/api'

const AppContext = createContext(null)

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_DOMAINS || 'betty.com')
  .split(',').map(d => d.trim().toLowerCase())

function getEmailDomain(email) { return email?.split('@')[1]?.toLowerCase() || '' }

export function AppProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [workspace, setWorkspace]     = useState(null)   // active workspace
  const [ownWorkspace, setOwnWorkspace] = useState(null) // user's own workspace
  const [workspaces, setWorkspaces]   = useState([])     // all accessible workspaces
  const [canEdit, setCanEdit]         = useState(true)   // false when viewing a shared workspace as viewer
  const [loading, setLoading]         = useState(true)
  const [authError, setAuthError]     = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleUser(session.user, session)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) handleUser(session.user, session)
      else { setUser(null); setWorkspace(null); setOwnWorkspace(null); setWorkspaces([]); setCanEdit(true); setLoading(false) }
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
    // 1. Get or create the user's own workspace
    let { data: own, error } = await supabase
      .from('workspaces').select('*').eq('user_id', u.id).single()
    if (error?.code === 'PGRST116') {
      const name = u.user_metadata?.full_name
        ? `${u.user_metadata.full_name}'s Workspace`
        : 'My Workspace'
      const { data: created } = await supabase
        .from('workspaces').insert({ user_id: u.id, name }).select().single()
      own = created
    }
    setOwnWorkspace(own)

    // 2. Claim any pending invitations for this email
    await supabase
      .from('workspace_members')
      .update({ user_id: u.id })
      .eq('invited_email', u.email)
      .is('user_id', null)

    // 3. Load all workspaces this user is a member of
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('role, workspace_id, workspaces(*)')
      .eq('user_id', u.id)

    const shared = (memberships || [])
      .filter(m => m.workspaces && m.workspace_id !== own?.id)
      .map(m => ({ ...m.workspaces, _memberRole: m.role }))

    const all = own ? [own, ...shared] : shared
    setWorkspaces(all)

    // 4. Restore last active workspace (if still accessible)
    const savedId = localStorage.getItem('activeWorkspaceId')
    const active  = all.find(w => w.id === savedId) || own || all[0] || null
    const role    = active?.id === own?.id ? null : shared.find(s => s.id === active?.id)?._memberRole || null
    setWorkspace(active)
    setCanEdit(!role || role === 'editor')
    return active
  }

  function switchWorkspace(id) {
    const target = workspaces.find(w => w.id === id)
    if (!target) return
    const role = target.id === ownWorkspace?.id ? null : target._memberRole || null
    setWorkspace(target)
    setCanEdit(!role || role === 'editor')
    localStorage.setItem('activeWorkspaceId', id)
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
    setUser(null); setWorkspace(null); setOwnWorkspace(null); setWorkspaces([]); setCanEdit(true)
  }

  return (
    <AppContext.Provider value={{ user, workspace, ownWorkspace, workspaces, canEdit, loading, authError, signInWithGoogle, signOut, switchWorkspace }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
