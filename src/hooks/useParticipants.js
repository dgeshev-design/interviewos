import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useParticipants(studyId = null) {
  const { workspace } = useApp()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    let q = supabase.from('participants').select('*').eq('workspace_id', workspace.id)
    if (studyId) q = q.eq('study_id', studyId)
    const { data } = await q.order('created_at', { ascending: false })
    setParticipants(data || [])
    setLoading(false)
  }, [workspace, studyId])

  useEffect(() => { fetch() }, [fetch])

  const add = async (p) => {
    const { data, error } = await supabase
      .from('participants').insert({ ...p, workspace_id: workspace.id }).select().single()
    if (error) throw new Error(error.message)
    setParticipants(prev => [data, ...prev])
    return data
  }

  const update = async (id, changes) => {
    const { data, error } = await supabase
      .from('participants').update(changes).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    setParticipants(prev => prev.map(p => p.id === id ? data : p))
    return data
  }

  const remove = async (id) => {
    await supabase.from('participants').delete().eq('id', id)
    setParticipants(prev => prev.filter(p => p.id !== id))
  }

  const getOne = async (id) => {
    const { data } = await supabase.from('participants').select('*').eq('id', id).single()
    return data
  }

  return { participants, loading, refetch: fetch, add, update, remove, getOne }
}
