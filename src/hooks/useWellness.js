import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToHabits } from '@/services/habitService'
import { subscribeToTodos } from '@/services/todoService'

export function useHabits() {
  const { user } = useAuth()
  const [habits, setHabits] = useState([])
  useEffect(() => {
    if (!user) {
      setHabits([])
      return undefined
    }
    return subscribeToHabits(user.uid, setHabits)
  }, [user])
  return habits
}

export function useTodos() {
  const { user } = useAuth()
  const [todos, setTodos] = useState([])
  useEffect(() => {
    if (!user) {
      setTodos([])
      return undefined
    }
    return subscribeToTodos(user.uid, setTodos)
  }, [user])
  return todos
}
