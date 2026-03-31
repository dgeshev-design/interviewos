import { useApp } from '@/context/AppContext'

export function useStudies() {
  const {
    studies, studiesLoading: loading,
    addStudy: add, updateStudy: update, removeStudy: remove, duplicateStudy: duplicate,
    refetchStudies: refetch,
  } = useApp()
  return { studies, loading, add, update, remove, duplicate, refetch }
}
