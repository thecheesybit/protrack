/**
 * Pure deadline helpers — no React, no Firebase imports.
 * Works with Firestore Timestamps, native Dates, ISO strings, and epoch numbers.
 */

function toDate(d) {
  if (!d) return null
  if (typeof d.toDate === 'function') return d.toDate()
  if (d instanceof Date) return d
  if (typeof d === 'number' || typeof d === 'string') return new Date(d)
  return null
}

function startOfDay(d) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

/** Returns 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | null */
export function classifyDeadline(dueAt) {
  const due = toDate(dueAt)
  if (!due) return null
  const now = new Date()
  const todayStart = startOfDay(now)
  const tomorrowStart = new Date(todayStart.getTime() + 86400000)
  const in3Days = new Date(todayStart.getTime() + 3 * 86400000)

  if (due < now) return 'overdue'
  if (due < tomorrowStart) return 'due_today'
  if (due < in3Days) return 'due_soon'
  return 'upcoming'
}

/** True if the dueAt falls on today's calendar date. */
export function isDueToday(dueAt) {
  const d = toDate(dueAt)
  if (!d) return false
  const today = startOfDay(new Date())
  const tomorrow = new Date(today.getTime() + 86400000)
  return d >= today && d < tomorrow
}

/** Convert a dueAt to minutes-from-midnight for grid positioning. */
export function dueAtToMinutes(dueAt) {
  const d = toDate(dueAt)
  if (!d) return null
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Returns todos + tasks due within windowHours sorted by urgency.
 * Items with column === 'done' or done === true are skipped.
 */
export function getUpcomingItems(todos = [], tasks = [], windowHours = 48) {
  const now = new Date()
  const cutoff = new Date(now.getTime() + windowHours * 3600000)
  const items = []

  for (const t of todos) {
    if (t.done) continue
    const due = toDate(t.dueAt)
    if (!due || due > cutoff) continue
    items.push({ ...t, _kind: 'todo', _due: due, _urgency: classifyDeadline(t.dueAt) })
  }
  for (const t of tasks) {
    if (t.column === 'done') continue
    const due = toDate(t.dueAt)
    if (!due || due > cutoff) continue
    items.push({ ...t, _kind: 'task', _due: due, _urgency: classifyDeadline(t.dueAt) })
  }

  return items.sort((a, b) => a._due - b._due)
}

/**
 * Returns notes whose reminder is enabled and whose deadline falls within
 * `windowHours` from now (default 48h — the "remind two days earlier" rule),
 * including already-overdue ones so nothing is silently missed. Sorted by due
 * time. Pure — the caller (hooks/useNoteReminders) handles notification/dedupe.
 */
export function getNoteReminders(notes = [], windowHours = 48) {
  const now = new Date()
  const cutoff = new Date(now.getTime() + windowHours * 3600000)
  const items = []

  for (const n of notes) {
    if (!n.reminderEnabled) continue
    const due = toDate(n.dueAt)
    if (!due || due > cutoff) continue
    items.push({ ...n, _due: due, _urgency: classifyDeadline(n.dueAt) })
  }

  return items.sort((a, b) => a._due - b._due)
}
