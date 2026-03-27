import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useSendLog(participantId = null) {
  const { workspace } = useApp()
  const [logs, setLogs]     = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    let q = supabase.from('send_log')
      .select('*, templates(name,channel,trigger_type)')
      .eq('workspace_id', workspace.id)
      .order('sent_at', { ascending: false })
    if (participantId) q = q.eq('participant_id', participantId)
    const { data } = await q.limit(50)
    setLogs(data || [])
    setLoading(false)
  }, [workspace, participantId])

  useEffect(() => { fetch() }, [fetch])

  const addLog = async (log) => {
    const { data } = await supabase.from('send_log')
      .insert({ ...log, workspace_id: workspace.id }).select().single()
    setLogs(prev => [data, ...prev])
    return data
  }

  return { logs, loading, refetch: fetch, addLog }
}
