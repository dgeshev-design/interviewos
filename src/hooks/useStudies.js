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

  const duplicate = async (id) => {
    const { data: { user } } = await supabase.auth.getUser()
    const original = studies.find(s => s.id === id)
    if (!original) return

    // Create new study row
    const slug = original.slug.replace(/-[a-z0-9]{4}$/, '') + '-' + Math.random().toString(36).slice(2, 6)
    const { data: newStudy, error } = await supabase.from('studies').insert({
      workspace_id:  original.workspace_id,
      name:          `${original.name} (Copy)`,
      description:   original.description,
      target_count:  original.target_count,
      status:        'draft',
      slug,
      created_by:    user?.id,
    }).select().single()
    if (error) throw new Error(error.message)

    // Copy the active form if one exists
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

  return { studies, loading, refetch: fetch, add, update, remove, duplicate }
}
