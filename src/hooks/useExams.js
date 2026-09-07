import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToExams } from '@/services/examService'

/**
 * Realtime exams hook. Supports specific modeId or aggregates across all modes if modeId === 'all'.
 */
export function useExams(modeId) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const [exams, setExams] = useState([])
  const [deletedExams, setDeletedExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !modeId) {
      setExams([])
      setDeletedExams([])
      setLoading(false)
      return undefined
    }

    setLoading(true)

    if (modeId === 'all') {
      if (!modes || modes.length === 0) {
        setExams([])
        setDeletedExams([])
        setLoading(false)
        return undefined
      }

      const activeMap = {}
      const deletedMap = {}
      const loadedModeIds = new Set()

      const unsubs = modes.map((m) =>
        subscribeToExams(user.uid, m.id, (activeList, delList) => {
          activeMap[m.id] = (activeList || []).map((item) => ({
            ...item,
            _modeName: m.name,
            _modeColor: m.accentColor,
            _modeId: m.id,
          }))

          deletedMap[m.id] = (delList || []).map((item) => ({
            ...item,
            _modeName: m.name,
            _modeColor: m.accentColor,
            _modeId: m.id,
          }))

          loadedModeIds.add(m.id)
          const allActive = Object.values(activeMap)
            .flat()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          const allDeleted = Object.values(deletedMap)
            .flat()
            .sort((a, b) => new Date(b.deletedAt || 0) - new Date(a.deletedAt || 0))

          setExams(allActive)
          setDeletedExams(allDeleted)
          if (loadedModeIds.size === modes.length) {
            setLoading(false)
          }
        })
      )

      return () => unsubs.forEach((u) => u())
    }

    const unsub = subscribeToExams(user.uid, modeId, (activeList, delList) => {
      setExams(activeList || [])
      setDeletedExams(delList || [])
      setLoading(false)
    })
    return unsub
  }, [user, modeId, modes])

  return { exams, deletedExams, loading }
}
