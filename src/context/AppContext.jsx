import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { saveGoogleToken } from '@/lib/api'

// Apply Betty theme before React hydration (also done in index.html, this keeps state in sync)
const BETTY_KEY = 'bettyMode'
function applyBetty(on) {
  if (on) document.documentElement.setAttribute('data-theme', 'betty')
  else document.documentElement.removeAttribute('data-theme')
}

const AppContext = createContext(null)

const ALLOWED_DOMAINS = (import.meta.env.VITE_ALLOWED_DOMAINS || 'betty.com')
  .split(',').map(d => d.trim().toLowerCase())

function getEmailDomain(email) { return email?.split('@')[1]?.toLowerCase() || '' }

export function AppProvider({ children }) {
  const [user, setUser]               = useState(null)
  const [workspace, setWorkspace]     = useState(null)
  const [ownWorkspace, setOwnWorkspace] = useState(null)
  const [workspaces, setWorkspaces]   = useState([])
  const [canEdit, setCanEdit]         = useState(true)
  const [loading, setLoading]         = useState(true)
  const [authError, setAuthError]     = useState(null)

  // ── Betty mode ────────────────────────────────────────────────────────
  const [bettyMode, setBettyModeState] = useState(() => localStorage.getItem(BETTY_KEY) === 'true')

  const toggleBettyMode = useCallback((val) => {
    const next = typeof val === 'boolean' ? val : !bettyMode
    setBettyModeState(next)
    localStorage.setItem(BETTY_KEY, String(next))
    applyBetty(next)
  }, [bettyMode])

  // ── Studies cache ──────────────────────────────────────────────────────
  const [studies, setStudies]           = useState([])
  const [studiesLoading, setStudiesLoading] = useState(false)

  // ── Participants cache ─────────────────────────────────────────────────
  const [participants, setParticipants]         = useState([])
  const [participantsLoading, setParticipantsLoading] = useState(false)

  const fetchStudies = useCallback(async (wsId) => {
    if (!wsId) return
    setStudiesLoading(true)
    const { data } = await supabase
      .from('studies').select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
    setStudies(data || [])
    setStudiesLoading(false)
  }, [])

  const fetchParticipants = useCallback(async (wsId) => {
    if (!wsId) return
    setParticipantsLoading(true)
    const { data } = await supabase
      .from('participants').select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false })
    setParticipants(data || [])
    setParticipantsLoading(false)
  }, [])

  // Re-fetch when workspace changes
  useEffect(() => {
    if (!workspace?.id) return
    fetchStudies(workspace.id)
    fetchParticipants(workspace.id)
  }, [workspace?.id])

  // ── Auth ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleUser(session.user, session)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) handleUser(session.user, session)
      else {
        setUser(null); setWorkspace(null); setOwnWorkspace(null); setWorkspaces([])
        setCanEdit(true); setLoading(false)
        setStudies([]); setParticipants([])
      }
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

    await supabase
      .from('workspace_members')
      .update({ user_id: u.id })
      .eq('invited_email', u.email)
      .is('user_id', null)

    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('role, workspace_id, workspaces(*)')
      .eq('user_id', u.id)

    const shared = (memberships || [])
      .filter(m => m.workspaces && m.workspace_id !== own?.id)
      .map(m => ({ ...m.workspaces, _memberRole: m.role }))

    const all = own ? [own, ...shared] : shared
    setWorkspaces(all)

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
    // Clear cache so next fetch gets fresh data for the new workspace
    setStudies([])
    setParticipants([])
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
    setStudies([]); setParticipants([])
  }

  // ── Studies mutations ──────────────────────────────────────────────────
  const addStudy = async (s) => {
    const { data: { user: u } } = await supabase.auth.getUser()
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data, error } = await supabase
      .from('studies').insert({ ...s, workspace_id: workspace.id, slug, created_by: u?.id }).select().single()
    if (error) throw new Error(error.message)
    setStudies(p => [data, ...p])
    return data
  }

  const updateStudy = async (id, changes) => {
    const { data, error } = await supabase
      .from('studies').update(changes).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    setStudies(p => p.map(s => s.id === id ? data : s))
    return data
  }

  const removeStudy = async (id) => {
    await supabase.from('studies').delete().eq('id', id)
    setStudies(p => p.filter(s => s.id !== id))
  }

  const duplicateStudy = async (id) => {
    const { data: { user: u } } = await supabase.auth.getUser()
    const original = studies.find(s => s.id === id)
    if (!original) return
    const slug = original.slug.replace(/-[a-z0-9]{4}$/, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data: newStudy, error } = await supabase.from('studies').insert({
      workspace_id: original.workspace_id,
      name:         `${original.name} (Copy)`,
      description:  original.description,
      target_count: original.target_count,
      status:       'draft',
      slug,
      created_by:   u?.id,
    }).select().single()
    if (error) throw new Error(error.message)
    const { data: originalForm } = await supabase.from('forms').select('*').eq('study_id', id).eq('is_active', true).maybeSingle()
    if (originalForm) {
      await supabase.from('forms').insert({
        study_id:       newStudy.id,
        workspace_id:   originalForm.workspace_id,
        is_active:      true,
        fields:         originalForm.fields,
        primary_color:  originalForm.primary_color,
        banner_url:     originalForm.banner_url,
        logo_url:       originalForm.logo_url,
        booking_config: originalForm.booking_config,
        step_titles:    originalForm.step_titles,
      })
    }
    setStudies(p => [newStudy, ...p])
    return newStudy
  }

  // ── Participants mutations ─────────────────────────────────────────────
  const addParticipant = async (p) => {
    const { data, error } = await supabase
      .from('participants').insert({ ...p, workspace_id: workspace.id }).select().single()
    if (error) throw new Error(error.message)
    setParticipants(prev => [data, ...prev])
    return data
  }

  const updateParticipant = async (id, changes) => {
    const { data, error } = await supabase
      .from('participants').update(changes).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    setParticipants(prev => prev.map(p => p.id === id ? data : p))
    return data
  }

  const removeParticipant = async (id) => {
    await supabase.from('participants').delete().eq('id', id)
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  return (
    <AppContext.Provider value={{
      user, workspace, ownWorkspace, workspaces, canEdit, loading, authError,
      signInWithGoogle, signOut, switchWorkspace,
      bettyMode, toggleBettyMode,
      // Studies
      studies, studiesLoading,
      addStudy, updateStudy, removeStudy, duplicateStudy,
      refetchStudies: () => fetchStudies(workspace?.id),
      // Participants
      participants, participantsLoading,
      addParticipant, updateParticipant, removeParticipant,
      refetchParticipants: () => fetchParticipants(workspace?.id),
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
