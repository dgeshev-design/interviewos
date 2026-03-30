import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useStudies() {
  const { workspace } = useApp()
  const [studies, setStudies] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data } = await supabase
      .from('studies').select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
    setStudies(data || [])
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const add = async (s) => {
    const { data: { user } } = await supabase.auth.getUser()
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data, error } = await supabase
      .from('studies').insert({ ...s, workspace_id: workspace.id, slug, created_by: user?.id }).select().single()
    if (error) throw new Error(error.message)
    setStudies(p => [data, ...p])
    return data
  }

  const update = async (id, changes) => {
    const { data, error } = await supabase
      .from('studies').update(changes).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    setStudies(p => p.map(s => s.id === id ? data : s))
    return data
  }

  const remove = async (id) => {
    await supabase.from('studies').delete().eq('id', id)
    setStudies(p => p.filter(s => s.id !== id))
  }

  return { studies, loading, refetch: fetch, add, update, remove }
}
