import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToNotes } from '@/services/noteService'

export function useNotes() {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])

  useEffect(() => {
    if (!user) {
      setNotes([])
      return undefined
    }
    return subscribeToNotes(user.uid, setNotes)
  }, [user])

  return notes
}
