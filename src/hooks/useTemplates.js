import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useTemplates() {
  const { workspace } = useApp()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]   = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })
    setTemplates(data || [])
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const add = async (t) => {
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...t, workspace_id: workspace.id })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setTemplates(prev => [...prev, data])
    return data
  }

  const update = async (id, changes) => {
    const { data, error } = await supabase
      .from('templates')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setTemplates(prev => prev.map(t => t.id === id ? data : t))
  }

  const remove = async (id) => {
    await supabase.from('templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  return { templates, loading, refetch: fetch, add, update, remove }
}
