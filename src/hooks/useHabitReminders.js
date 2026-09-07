import React, { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useHabits } from '@/hooks/useWellness'
import { useStore } from '@/store/useStore'
import { notify } from '@/lib/notify'
import { playHabitChime } from '@/lib/audioFX'
import { HabitReminderToast } from '@/components/wellness/HabitReminderToast'
import { recordHabitCompletion, toggleHabitToday } from '@/services/habitService'
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

export const INTERVAL_MIN = {
  'every-20m': 20,
  'every-30m': 30,
  'every-45m': 45,
  'every-1h': 60,
  'every-90m': 90,
  'every-2h': 120,
  'every-3h': 180,
  'every-4h': 240,
  'every-6h': 360,
  'every-8h': 480,
  'every-12h': 720,
}

/** Minutes-from-midnight when a "morning" / "evening" cue should fire. */
const FIXED_TIMES_MIN = {
  morning: 9 * 60,
  afternoon: 14 * 60,
  evening: 19 * 60,
}

function nextFireFor(habit, now = new Date()) {
  const intervalMin = habit.customIntervalMin || INTERVAL_MIN[habit.interval]
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
  const today = ymd()
  if (habit?.dayLogs && typeof habit.dayLogs[today] === 'number') {
    return habit.dayLogs[today]
  }
  return (habit?.doneDates || []).includes(today) ? 1 : 0
}

/**
 * Fires the interactive toast, audio chime, and Dynamic Island notification
 * for a habit reminder.
 */
export function triggerHabitCue(uid, habit) {
  if (!uid || !habit) return

  // 1. Auditory Chime (if sound not disabled)
  if (habit.reminderSound !== false) {
    playHabitChime()
  }

  const target = Math.max(1, habit.timesPerDay || 1)
  const current = completionsToday(habit)

  // 2. Interactive In-App Toast
  if (habit.reminderToast !== false) {
    toast.custom(
      (t) =>
        React.createElement(HabitReminderToast, {
          toastId: t.id,
          habit,
          targetCount: target,
          currentCount: current,
          onDone: async (h) => {
            await recordHabitCompletion(uid, h)
          },
          onSnooze: () => {
            setTimeout(() => {
              triggerHabitCue(uid, habit)
            }, 10 * 60 * 1000)
          },
        }),
      {
        duration: 28000,
        id: `habit-reminder-${habit.id}`,
      },
    )
  }

  // 3. Dynamic Island Banner
  useStore.getState().pushIsland({
    kind: habit.icon === 'Droplets' ? 'water' : 'info',
    title: `Time to ${habit.name}`,
    detail: habit.scienceRationale
      ? `${habit.scienceRationale.slice(0, 75)}…`
      : 'Click Done on the reminder toast to track.',
    duration: 6500,
  })

  // 4. Background OS Native Notification
  notify(
    `Habit Reminder · ${habit.name}`,
    habit.scienceRationale || `Time to ${habit.name.toLowerCase()}. Open PRO TRACK to track response.`,
  )
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

          triggerHabitCue(user.uid, habit)
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

  const intervalMin = habit.customIntervalMin || INTERVAL_MIN[habit.interval]
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
