import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useSlots(studyId = null, userId = null) {
  const { workspace } = useApp()
  const [slots, setSlots]   = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    let q = supabase.from('slots').select('*, participants(name,email,status)')
      .eq('workspace_id', workspace.id)
      .gte('starts_at', (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() })())
      .order('starts_at', { ascending: true })
    if (studyId) q = q.eq('study_id', studyId)
    if (userId)  q = q.eq('user_id', userId)
    const { data } = await q
    setSlots(data || [])
    setLoading(false)
  }, [workspace, studyId, userId])

  useEffect(() => { fetch() }, [fetch])

  const addSlot = async (s) => {
    const starts = new Date(s.starts_at)
    const ends   = new Date(starts.getTime() + s.duration_minutes * 60000)
    const { data, error } = await supabase.from('slots').insert({
      ...s,
      workspace_id: workspace.id,
      user_id: userId || null,
      ends_at: ends.toISOString(),
      available: true,
      is_gcal_block: false,
    }).select().single()
    if (error) throw new Error(error.message)
    setSlots(prev => [...prev, data].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
    return data
  }

  const updateSlot = async (id, changes) => {
    const { data } = await supabase.from('slots').update(changes).eq('id', id).select().single()
    setSlots(prev => prev.map(s => s.id === id ? data : s))
    return data
  }

  const removeSlot = async (id) => {
    await supabase.from('slots').delete().eq('id', id)
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  const removeSlots = async (ids) => {
    await supabase.from('slots').delete().in('id', ids)
    setSlots(prev => prev.filter(s => !ids.includes(s.id)))
  }

  return { slots, loading, refetch: fetch, addSlot, updateSlot, removeSlot, removeSlots }
}
