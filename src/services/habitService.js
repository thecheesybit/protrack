import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ymd } from '@/lib/dates'

const habitsCol = (uid) => collection(db, 'users', uid, 'habits')

export function subscribeToHabits(uid, callback) {
  return onSnapshot(habitsCol(uid), (snap) => {
    const habits = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    callback(habits)
  })
}

export async function addHabit(uid, {
  name,
  icon,
  color,
  order,
  timesPerWeek,
  timesPerDay,
  interval,
  customIntervalMin,
  recommendedInterval,
  scienceRationale,
  scienceDomain,
  reminderToast,
  reminderSound,
}) {
  return addDoc(habitsCol(uid), {
    name,
    icon: icon || 'Heart',
    color: color || '#10b981',
    doneDates: [],
    dayLogs: {},
    order: order ?? 0,
    timesPerWeek: timesPerWeek ?? 7,
    timesPerDay: timesPerDay ?? 1,
    interval: interval || 'none',
    customIntervalMin: customIntervalMin || null,
    recommendedInterval: recommendedInterval || interval || null,
    scienceRationale: scienceRationale || '',
    scienceDomain: scienceDomain || '',
    reminderToast: reminderToast !== false,
    reminderSound: reminderSound !== false,
    createdAt: serverTimestamp(),
  })
}

export async function updateHabit(uid, habitId, patch) {
  return updateDoc(doc(habitsCol(uid), habitId), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteHabit(uid, habitId) {
  return deleteDoc(doc(habitsCol(uid), habitId))
}

/**
 * Record a habit completion event (e.g. from an automated reminder toast or widget check).
 * Increments the day's completion count and ensures today is marked in doneDates.
 */
export async function recordHabitCompletion(uid, habit) {
  const today = ymd()
  const dayLogs = habit.dayLogs || {}
  const currentCount = typeof dayLogs[today] === 'number'
    ? dayLogs[today]
    : ((habit.doneDates || []).includes(today) ? 1 : 0)
  const nextCount = currentCount + 1

  return updateDoc(doc(habitsCol(uid), habit.id), {
    [`dayLogs.${today}`]: nextCount,
    doneDates: arrayUnion(today),
    lastCompletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Toggle today's completion atomically (merge-safe across devices). */
export async function toggleHabitToday(uid, habit) {
  const today = ymd()
  const dayLogs = habit.dayLogs || {}
  const target = Math.max(1, habit.timesPerDay || 1)
  const current = typeof dayLogs[today] === 'number'
    ? dayLogs[today]
    : ((habit.doneDates || []).includes(today) ? 1 : 0)

  if (target > 1) {
    // For multiple times per day habits:
    // If completed all or toggling down, cycle back or increment
    if (current >= target) {
      // Reset today
      return updateDoc(doc(habitsCol(uid), habit.id), {
        [`dayLogs.${today}`]: 0,
        doneDates: arrayRemove(today),
        updatedAt: serverTimestamp(),
      })
    } else {
      return recordHabitCompletion(uid, habit)
    }
  }

  // Standard 1x per day toggle
  const done = (habit.doneDates || []).includes(today)
  return updateDoc(doc(habitsCol(uid), habit.id), {
    doneDates: done ? arrayRemove(today) : arrayUnion(today),
    [`dayLogs.${today}`]: done ? 0 : 1,
    updatedAt: serverTimestamp(),
  })
}
