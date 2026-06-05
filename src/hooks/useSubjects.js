import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToSubjects, subscribeToTasks } from '@/services/subjectService'

/** Realtime subjects for a mode. */
export function useSubjects(modeId) {
  const { user } = useAuth()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !modeId) {
      setSubjects([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const unsub = subscribeToSubjects(user.uid, modeId, (s) => {
      setSubjects(s)
      setLoading(false)
    })
    return unsub
  }, [user, modeId])

  return { subjects, loading }
}

/** Realtime micro-Kanban tasks for one subject. */
export function useTasks(modeId, subjectId) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (!user || !modeId || !subjectId) {
      setTasks([])
      return undefined
    }
    const unsub = subscribeToTasks(user.uid, modeId, subjectId, setTasks)
    return unsub
  }, [user, modeId, subjectId])

  return tasks
}
