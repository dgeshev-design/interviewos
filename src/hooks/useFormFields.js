import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useFormFields() {
  const { workspace } = useApp()
  const [fields, setFields]   = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data } = await supabase
      .from('form_fields')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('position', { ascending: true })
    setFields(data || [])
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const add = async (f) => {
    const { data, error } = await supabase
      .from('form_fields')
      .insert({ ...f, workspace_id: workspace.id, position: fields.length })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setFields(prev => [...prev, data])
  }

  const update = async (id, changes) => {
    const { data, error } = await supabase
      .from('form_fields')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setFields(prev => prev.map(f => f.id === id ? data : f))
  }

  const remove = async (id) => {
    await supabase.from('form_fields').delete().eq('id', id)
    setFields(prev => prev.filter(f => f.id !== id))
  }

  const reorder = async (id, direction) => {
    const idx = fields.findIndex(f => f.id === id)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= fields.length) return
    const updated = [...fields]
    ;[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]]
    setFields(updated)
    // Persist new positions
    await Promise.all([
      supabase.from('form_fields').update({ position: newIdx }).eq('id', updated[newIdx].id),
      supabase.from('form_fields').update({ position: idx   }).eq('id', updated[idx].id),
    ])
  }

  return { fields, loading, refetch: fetch, add, update, remove, reorder }
}
