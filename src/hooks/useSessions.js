import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useSessions() {
  const { workspace } = useApp()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)

  const startSession = useCallback(async (participantId) => {
    setLoading(true)
    // Check for existing open session
    const { data: existing } = await supabase
      .from('sessions')
      .select('*')
      .eq('participant_id', participantId)
      .is('ended_at', null)
      .single()

    if (existing) { setSession(existing); setLoading(false); return existing }

    const { data, error } = await supabase
      .from('sessions')
      .insert({ workspace_id: workspace.id, participant_id: participantId, notes: {}, done_questions: [] })
      .select()
      .single()

    if (error) throw new Error(error.message)
    setSession(data)
    setLoading(false)
    return data
  }, [workspace])

  const updateNotes = async (sessionId, questionId, noteText) => {
    const notes = { ...(session?.notes || {}), [questionId]: noteText }
    const { data, error } = await supabase
      .from('sessions')
      .update({ notes })
      .eq('id', sessionId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setSession(data)
  }

  const toggleDone = async (sessionId, questionId) => {
    const done = session?.done_questions || []
    const updated = done.includes(questionId)
      ? done.filter(id => id !== questionId)
      : [...done, questionId]
    const { data } = await supabase
      .from('sessions')
      .update({ done_questions: updated })
      .eq('id', sessionId)
      .select()
      .single()
    setSession(data)
  }

  const saveSummary = async (sessionId, summary) => {
    const { data } = await supabase
      .from('sessions')
      .update({ summary, ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single()
    setSession(data)
  }

  return { session, loading, startSession, updateNotes, toggleDone, saveSummary }
}
