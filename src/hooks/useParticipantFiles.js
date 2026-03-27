import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'

export function useParticipantFiles(participantId) {
  const { workspace, user } = useApp()
  const [files, setFiles]   = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!participantId) return
    setLoading(true)
    const { data } = await supabase
      .from('participant_files').select('*')
      .eq('participant_id', participantId)
      .order('created_at', { ascending: false })
    setFiles(data || [])
    setLoading(false)
  }, [participantId])

  useEffect(() => { fetch() }, [fetch])

  const upload = async (file, fileType) => {
    const ext  = file.name.split('.').pop()
    const path = `${user.id}/${participantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('participant-files').upload(path, file)
    if (uploadError) throw new Error(uploadError.message)

    const { data, error } = await supabase.from('participant_files').insert({
      workspace_id:   workspace.id,
      participant_id: participantId,
      file_type:      fileType,
      filename:       file.name,
      storage_path:   path,
      size_bytes:     file.size,
      mime_type:      file.type,
    }).select().single()
    if (error) throw new Error(error.message)

    setFiles(prev => [data, ...prev])
    return data
  }

  const getUrl = async (storagePath) => {
    const { data } = await supabase.storage
      .from('participant-files').createSignedUrl(storagePath, 3600)
    return data?.signedUrl || ''
  }

  const remove = async (id, storagePath) => {
    await supabase.storage.from('participant-files').remove([storagePath])
    await supabase.from('participant_files').delete().eq('id', id)
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  return { files, loading, refetch: fetch, upload, getUrl, remove }
}
