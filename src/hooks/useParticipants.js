import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useParticipants() {
  const { workspace } = useApp()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setParticipants(data || [])
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const add = async (p) => {
    const { data, error } = await supabase
      .from('participants')
      .insert({ ...p, workspace_id: workspace.id })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setParticipants(prev => [data, ...prev])
    return data
  }

  const update = async (id, changes) => {
    const { data, error } = await supabase
      .from('participants')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setParticipants(prev => prev.map(p => p.id === id ? data : p))
    return data
  }

  const remove = async (id) => {
    const { error } = await supabase.from('participants').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  return { participants, loading, error, refetch: fetch, add, update, remove }
}
