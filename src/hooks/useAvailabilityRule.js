import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/context/AppContext'
import { getAvailabilityRule, saveAvailabilityRule } from '@/lib/api'

export function useAvailabilityRule() {
  const { workspace } = useApp()
  const [rule, setRule]       = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!workspace) return
    setLoading(true)
    try {
      const r = await getAvailabilityRule(workspace.id)
      setRule(r || null)
    } catch {}
    setLoading(false)
  }, [workspace])

  useEffect(() => { fetch() }, [fetch])

  const saveRule = async (payload) => {
    const saved = await saveAvailabilityRule({ workspaceId: workspace.id, ...payload })
    if (!saved?.error) setRule(saved)
    return saved
  }

  return { rule, loading, saveRule, refetch: fetch }
}
