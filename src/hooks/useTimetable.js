import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToSlots } from '@/services/timetableService'

/** Realtime timetable slots for the given mode. */
export function useTimetable(modeId) {
  const { user } = useAuth()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !modeId) {
      setSlots([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const unsub = subscribeToSlots(user.uid, modeId, (s) => {
      setSlots(s)
      setLoading(false)
    })
    return unsub
  }, [user, modeId])

  return { slots, loading }
}
