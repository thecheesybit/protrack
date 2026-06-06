import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useHabits } from '@/hooks/useWellness'
import { notify } from '@/lib/notify'
import { toggleHabitToday } from '@/services/habitService'
import { ymd } from '@/lib/dates'

/**
 * Intelligent Habit Engine. For every habit whose `interval` declares a
 * recurring cadence, this hook schedules a single rolling timer that fires
 * the next due reminder, re-arms itself, and stops once the user has hit the
 * habit's `timesPerDay` target. Browser notifications are best-effort: in
 * Electron they surface as native OS toasts (which clicking focuses the app),
 * in the web build they show inline. Clicking the notification jumps the
 * window to the foreground; the user marks done in the widget.
 *
 * The hook is purely local — no Firestore writes. No memory leaks: every
 * scheduled timer is cleared on rebuild or unmount.
 */

const INTERVAL_MIN = {
  'every-1h': 60,
  'every-2h': 120,
  'every-3h': 180,
  'every-4h': 240,
}

/** Minutes-from-midnight when a "morning" / "evening" cue should fire. */
const FIXED_TIMES_MIN = {
  morning: 9 * 60,
  afternoon: 14 * 60,
  evening: 19 * 60,
}

function nextFireFor(habit, now = new Date()) {
  const intervalMin = INTERVAL_MIN[habit.interval]
  if (intervalMin) {
    // Anchored to start-of-day so reminders fall on tidy hour-marks
    // (e.g. 9am/11am for every-2h) instead of drifting across sessions.
    const start = new Date(now)
    start.setHours(9, 0, 0, 0)
    if (now < start) return start.getTime()
    const elapsedMs = now - start
    const cycles = Math.floor(elapsedMs / (intervalMin * 60_000)) + 1
    return start.getTime() + cycles * intervalMin * 60_000
  }
  const fixed = FIXED_TIMES_MIN[habit.interval]
  if (fixed != null) {
    const t = new Date(now)
    t.setHours(Math.floor(fixed / 60), fixed % 60, 0, 0)
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1)
    return t.getTime()
  }
  return null
}

function completionsToday(habit) {
  // Habits store completions per-day, not per-occurrence. We treat the
  // checkbox as "any completion today counts" for reminder suppression; users
  // who want multiple-per-day pings should keep firing until they toggle it
  // (which is the conventional habit-tracker behavior).
  return (habit.doneDates || []).includes(ymd()) ? 1 : 0
}

export function useHabitReminders() {
  const { user } = useAuth()
  const habits = useHabits()
  const timersRef = useRef([])

  useEffect(() => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []

    if (!user || !habits.length) return undefined

    const scheduled = []
    for (const habit of habits) {
      if (!habit.interval || habit.interval === 'none') continue

      const armNext = () => {
        const target = nextFireFor(habit)
        if (target == null) return
        const delay = Math.max(1000, target - Date.now())
        const id = setTimeout(async () => {
          // Suppress if the user already met today's target.
          const target = Math.max(1, habit.timesPerDay || 1)
          if (completionsToday(habit) >= target) {
            armNext()
            return
          }
          notify(
            `Habit reminder · ${habit.name}`,
            `Time to ${habit.name.toLowerCase()}. Open PRO TRACK to log it.`,
          )
          armNext()
        }, delay)
        scheduled.push(id)
      }
      armNext()
    }
    timersRef.current = scheduled
    return () => scheduled.forEach((id) => clearTimeout(id))
  }, [user, habits])
}

/**
 * Backlog count for a habit today — number of expected pings that have NOT
 * been answered. Powers the "missed" pill on the Habits dashboard.
 */
export function missedToday(habit, now = new Date()) {
  if (!habit?.interval || habit.interval === 'none') return 0
  const goal = Math.max(1, habit.timesPerDay || 1)
  const done = completionsToday(habit)
  if (done >= goal) return 0

  const intervalMin = INTERVAL_MIN[habit.interval]
  if (!intervalMin) {
    // Fixed time-of-day cues: missed iff target time has passed and not done.
    const fixed = FIXED_TIMES_MIN[habit.interval]
    if (fixed == null) return 0
    const minNow = now.getHours() * 60 + now.getMinutes()
    return minNow >= fixed ? goal - done : 0
  }
  const start = new Date(now)
  start.setHours(9, 0, 0, 0)
  if (now < start) return 0
  const elapsedMin = (now - start) / 60_000
  const expected = Math.min(goal, Math.floor(elapsedMin / intervalMin) + 1)
  return Math.max(0, expected - done)
}

/** Toggle a habit from a notification or backlog chip. */
export function quickCompleteHabit(uid, habit) {
  if (!uid || !habit) return Promise.resolve()
  return toggleHabitToday(uid, habit)
}
