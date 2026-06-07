import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { useTodos } from '@/hooks/useWellness'
import { getUpcomingItems } from '@/lib/deadlines'

/**
 * Fires Dynamic Island notifications for overdue/upcoming todos.
 * Runs an immediate check on mount + every 30 minutes.
 * Keeps a notified-id set so each item only fires once per session.
 */
export function useDeadlines() {
  const todos = useTodos()
  const pushIsland = useStore((s) => s.pushIsland)
  const notifiedRef = useRef(new Set())

  useEffect(() => {
    if (!todos.length) return

    const check = () => {
      const upcoming = getUpcomingItems(todos, [], 2)
      const fresh = upcoming.filter((i) => !notifiedRef.current.has(i.id))
      if (!fresh.length) return

      const overdue = fresh.filter((i) => i._urgency === 'overdue')
      const dueToday = fresh.filter((i) => i._urgency === 'due_today')

      if (overdue.length) {
        const first = overdue[0]
        pushIsland({
          kind: 'deadline',
          title: 'Overdue',
          detail:
            (first.text || first.title) +
            (overdue.length > 1 ? ` +${overdue.length - 1} more` : ''),
          duration: 7000,
        })
        overdue.forEach((i) => notifiedRef.current.add(i.id))
      } else if (dueToday.length) {
        const first = dueToday[0]
        pushIsland({
          kind: 'deadline',
          title: 'Due today',
          detail:
            (first.text || first.title) +
            (dueToday.length > 1 ? ` +${dueToday.length - 1} more` : ''),
          duration: 5500,
        })
        dueToday.forEach((i) => notifiedRef.current.add(i.id))
      }
    }

    check()
    const id = setInterval(check, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [todos, pushIsland])
}
