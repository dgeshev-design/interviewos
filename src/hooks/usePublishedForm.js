import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function usePublishedForm() {
  const { workspace } = useApp()
  const [publishedForm, setPublishedForm] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    const { data } = await supabase
      .from('published_forms')
      .select('*')
      .eq('workspace_id', workspace.id)
      .single()
    setPublishedForm(data || null)
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const publish = async () => {
    if (publishedForm) return publishedForm

    const { data, error } = await supabase
      .from('published_forms')
      .insert({ workspace_id: workspace.id })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setPublishedForm(data)
    return data
  }

  const unpublish = async () => {
    if (!publishedForm) return
    await supabase.from('published_forms').delete().eq('id', publishedForm.id)
    setPublishedForm(null)
  }

  return { publishedForm, loading, publish, unpublish, refetch: fetch }
}
