import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToHabits } from '@/services/habitService'
import { subscribeToTodos } from '@/services/todoService'
import { subscribeWithCache, getCachedValue } from '@/services/subscriptionCache'

export function useHabits() {
  const { user } = useAuth()
  const uid = user?.uid
  const cacheKey = uid ? `habits:${uid}` : null
  const [habits, setHabits] = useState(() => (cacheKey ? getCachedValue(cacheKey) || [] : []))

  useEffect(() => {
    if (!uid) {
      setHabits([])
      return undefined
    }
    return subscribeWithCache(
      `habits:${uid}`,
      (emit) => subscribeToHabits(uid, emit),
      setHabits,
    )
  }, [uid])

  return habits
}

export function useTodos() {
  const { user } = useAuth()
  const uid = user?.uid
  const cacheKey = uid ? `todos:${uid}` : null
  const [todos, setTodos] = useState(() => (cacheKey ? getCachedValue(cacheKey) || [] : []))

  useEffect(() => {
    if (!uid) {
      setTodos([])
      return undefined
    }
    return subscribeWithCache(
      `todos:${uid}`,
      (emit) => subscribeToTodos(uid, emit),
      setTodos,
    )
  }, [uid])

  return todos
}

