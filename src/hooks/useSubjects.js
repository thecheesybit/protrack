import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToSubjects, subscribeToTasks } from '@/services/subjectService'

/** Realtime subjects for a mode, or aggregated if modeId === 'all' */
export function useSubjects(modeId) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !modeId) {
      setSubjects([])
      setLoading(false)
      return undefined
    }

    setLoading(true)

    if (modeId === 'all') {
      if (!modes || modes.length === 0) {
        setSubjects([])
        setLoading(false)
        return undefined
      }

      const subjectsMap = {}
      const loadedModeIds = new Set()

      const unsubs = modes.map(m => subscribeToSubjects(user.uid, m.id, (s) => {
        // Tag subjects with their origin mode
        subjectsMap[m.id] = s.map(subj => ({ 
          ...subj, 
          _modeName: m.name, 
          _modeColor: m.accentColor,
          _modeId: m.id 
        }))
        
        loadedModeIds.add(m.id)
        const allSubjs = Object.values(subjectsMap).flat().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        setSubjects(allSubjs)
        
        if (loadedModeIds.size === modes.length) {
          setLoading(false)
        }
      }))
      
      return () => unsubs.forEach(u => u())
    }

    const unsub = subscribeToSubjects(user.uid, modeId, (s) => {
      setSubjects(s)
      setLoading(false)
    })
    return unsub
  }, [user, modeId, modes])

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
