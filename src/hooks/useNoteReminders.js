import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { useNotes } from '@/hooks/useNotes'
import { getNoteReminders } from '@/lib/deadlines'
import { notify } from '@/lib/notify'

/**
 * Fires reminders for notes that have a deadline with reminders enabled.
 * Mounted once (in Dashboard). A note is announced when its deadline enters the
 * 48-hour window ("remind two days earlier") via three channels — an OS
 * notification, a toast, and a Dynamic Island event — and only once per note
 * per session (tracked in `notifiedRef`).
 *
 * No new Firestore reads: it reuses the bounded notes listener from useNotes.
 */
export function useNoteReminders() {
  const notes = useNotes()
  const pushIsland = useStore((s) => s.pushIsland)
  const notifiedRef = useRef(new Set())

  useEffect(() => {
    if (!notes.length) return undefined

    const check = () => {
      const due = getNoteReminders(notes, 48)
      const fresh = due.filter((n) => !notifiedRef.current.has(n.id))
      if (!fresh.length) return

      fresh.forEach((n) => notifiedRef.current.add(n.id))

      const first = fresh[0]
      const label = first.title || 'Note'
      const extra = fresh.length > 1 ? ` +${fresh.length - 1} more` : ''
      const overdue = first._urgency === 'overdue'
      const headline = overdue ? 'Note overdue' : 'Note reminder'
      const detail = overdue
        ? `${label} is past its deadline${extra}`
        : `${label} is due soon${extra}`

      notify(headline, detail)
      toast(detail, { icon: overdue ? '⏰' : '🔔' })
      pushIsland({
        kind: 'deadline',
        title: headline,
        detail: `${label}${extra}`,
        duration: 6500,
      })
    }

    check()
    const id = setInterval(check, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [notes, pushIsland])
}
