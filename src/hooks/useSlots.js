import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useSlots() {
  const { workspace } = useApp()
  const [slots, setSlots]   = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data } = await supabase
      .from('slots')
      .select('*')
      .eq('workspace_id', workspace.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    setSlots(data || [])
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const addSlot = async ({ starts_at, duration_minutes = 60, meet_link = '' }) => {
    const { data, error } = await supabase
      .from('slots')
      .insert({
        workspace_id:     workspace.id,
        starts_at,
        duration_minutes,
        meet_link,
        available:        true,
        participant_id:   null,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setSlots(prev => [...prev, data].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
    return data
  }

  const removeSlot = async (id) => {
    await supabase.from('slots').delete().eq('id', id)
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  const updateSlot = async (id, changes) => {
    const { data } = await supabase
      .from('slots')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    setSlots(prev => prev.map(s => s.id === id ? data : s))
  }

  return { slots, loading, refetch: fetch, addSlot, removeSlot, updateSlot }
}
