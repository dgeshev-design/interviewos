import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useQuestions() {
  const { workspace } = useApp()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data } = await supabase
      .from('questions')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('position', { ascending: true })
    setQuestions(data || [])
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const add = async (q) => {
    const position = questions.length
    const { data, error } = await supabase
      .from('questions')
      .insert({ ...q, workspace_id: workspace.id, position })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setQuestions(prev => [...prev, data])
    return data
  }

  const update = async (id, changes) => {
    const { data, error } = await supabase
      .from('questions')
      .update(changes)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setQuestions(prev => prev.map(q => q.id === id ? data : q))
  }

  const remove = async (id) => {
    await supabase.from('questions').delete().eq('id', id)
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const bulkInsert = async (qs) => {
    const rows = qs.map((q, i) => ({ ...q, workspace_id: workspace.id, position: questions.length + i }))
    const { data, error } = await supabase.from('questions').insert(rows).select()
    if (error) throw new Error(error.message)
    setQuestions(prev => [...prev, ...data])
    return data
  }

  return { questions, loading, refetch: fetch, add, update, remove, bulkInsert }
}
