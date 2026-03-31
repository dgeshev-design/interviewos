import { useApp } from '@/context/AppContext'

export function useParticipants(studyId = null) {
  const {
    participants: all, participantsLoading: loading,
    addParticipant: addFn, updateParticipant: update, removeParticipant: remove,
    refetchParticipants: refetch,
  } = useApp()

  const participants = studyId ? all.filter(p => p.study_id === studyId) : all

  const add = (p) => addFn({ ...p, study_id: studyId || p.study_id })

  // getOne still hits DB directly since it's used for fresh data after form submission
  const getOne = async (id) => {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase.from('participants').select('*').eq('id', id).single()
    return data
  }

  return { participants, loading, add, update, remove, refetch, getOne }
}
