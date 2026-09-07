import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToSessions } from '@/services/focusService'
import { subscribeWithCache, getCachedValue } from '@/services/subscriptionCache'

/** Realtime recent focus sessions for the signed-in user. */
export function useFocusSessions(max = 300) {
  const { user } = useAuth()
  const uid = user?.uid
  const cacheKey = uid ? `sessions:${uid}:${max}` : null
  const [sessions, setSessions] = useState(() => (cacheKey ? getCachedValue(cacheKey) || [] : []))
  const [loading, setLoading] = useState(() => !(cacheKey && getCachedValue(cacheKey)))

  useEffect(() => {
    if (!uid) {
      setSessions([])
      setLoading(false)
      return undefined
    }
    return subscribeWithCache(
      `sessions:${uid}:${max}`,
      (emit) => subscribeToSessions(uid, emit, max),
      (s) => {
        setSessions(s)
        setLoading(false)
      },
    )
  }, [uid, max])

  return { sessions, loading }
}

