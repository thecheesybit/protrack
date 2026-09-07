import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToNotes } from '@/services/noteService'
import { subscribeWithCache, getCachedValue } from '@/services/subscriptionCache'

export function useNotes() {
  const { user } = useAuth()
  const uid = user?.uid
  const cacheKey = uid ? `notes:${uid}` : null
  const [notes, setNotes] = useState(() => (cacheKey ? getCachedValue(cacheKey) || [] : []))

  useEffect(() => {
    if (!uid) {
      setNotes([])
      return undefined
    }
    return subscribeWithCache(
      `notes:${uid}`,
      (emit) => subscribeToNotes(uid, emit),
      setNotes,
    )
  }, [uid])

  return notes
}

