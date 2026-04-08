import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export const DEFAULT_STYLE = {
  bgColor:         '#f4f4f5',
  cardBg:          '#ffffff',
  borderStyle:     'border',
  accentColor:     '#6366f1',
  spacing:         'normal',
  showLogo:        false,
  logoUrl:         '',
  showHeaderImage: false,
  headerImageUrl:  '',
  buttonText:      'Continue to booking →',
}

export function usePublishedForm() {
  const { workspace } = useApp()
  const [publishedForm, setPublishedForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingStyle, setPendingStyle] = useState(null)

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

  const styleConfig = publishedForm?.style_config
    ? { ...DEFAULT_STYLE, ...publishedForm.style_config }
    : pendingStyle
    ? { ...DEFAULT_STYLE, ...pendingStyle }
    : { ...DEFAULT_STYLE }

  const publish = async () => {
    if (publishedForm) return publishedForm

    const { data, error } = await supabase
      .from('published_forms')
      .insert({ workspace_id: workspace.id, style_config: pendingStyle || DEFAULT_STYLE })
      .select()
      .single()
    if (error) throw new Error(error.message)
    setPublishedForm(data)
    setPendingStyle(null)
    return data
  }

  const unpublish = async () => {
    if (!publishedForm) return
    await supabase.from('published_forms').delete().eq('id', publishedForm.id)
    setPublishedForm(null)
  }

  const saveStyle = async (config) => {
    if (!publishedForm) {
      setPendingStyle(config)
      return
    }
    const { data, error } = await supabase
      .from('published_forms')
      .update({ style_config: config })
      .eq('id', publishedForm.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setPublishedForm(data)
  }

  return { publishedForm, loading, publish, unpublish, refetch: fetch, styleConfig, saveStyle }
}
