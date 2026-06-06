import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToSessions } from '@/services/focusService'

/** Realtime recent focus sessions for the signed-in user. */
export function useFocusSessions() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setSessions([])
      setLoading(false)
      return undefined
    }
    const unsub = subscribeToSessions(user.uid, (s) => {
      setSessions(s)
      setLoading(false)
    })
    return unsub
  }, [user])

  return { sessions, loading }
}
