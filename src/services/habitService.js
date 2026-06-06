import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
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

export async function addHabit(uid, { name, icon, color, order }) {
  return addDoc(habitsCol(uid), {
    name,
    icon: icon || 'Heart',
    color: color || '#10b981',
    doneDates: [],
    order: order ?? 0,
    createdAt: serverTimestamp(),
  })
}

export async function updateHabit(uid, habitId, patch) {
  return updateDoc(doc(habitsCol(uid), habitId), patch)
}

export async function deleteHabit(uid, habitId) {
  return deleteDoc(doc(habitsCol(uid), habitId))
}

/** Toggle today's completion (doneDates stored on the habit doc). */
export async function toggleHabitToday(uid, habit) {
  const today = ymd()
  const dates = habit.doneDates || []
  const next = dates.includes(today)
    ? dates.filter((d) => d !== today)
    : [...dates, today]
  return updateHabit(uid, habit.id, { doneDates: next })
}
