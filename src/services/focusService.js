import {
  collection,
  addDoc,
  doc,
  runTransaction,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ymd, computeStreak } from '@/lib/dates'

/**
 * Record a completed focus session and atomically roll up the gamification
 * stats (total minutes, trees, active days, streak, longest session).
 */
export async function logFocusSession(uid, { modeId, subjectId, durationMin, startedAt, hourOfDay }) {
  await addDoc(collection(db, 'users', uid, 'focusSessions'), {
    modeId: modeId || null,
    subjectId: subjectId || null,
    durationMin,
    completed: true,
    hourOfDay,
    startedAt: startedAt || serverTimestamp(),
    createdAt: serverTimestamp(),
  })

  const ref = doc(db, 'users', uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const stats = snap.data()?.statsAggregate || {}
    const today = ymd()
    const activeDays = stats.activeDays?.includes(today)
      ? stats.activeDays
      : [...(stats.activeDays || []), today]
    tx.update(ref, {
      'statsAggregate.totalFocusMin': (stats.totalFocusMin || 0) + durationMin,
      'statsAggregate.treesGrown': (stats.treesGrown || 0) + 1,
      'statsAggregate.activeDays': activeDays,
      'statsAggregate.currentStreak': computeStreak(activeDays),
      'statsAggregate.longestSessionMin': Math.max(stats.longestSessionMin || 0, durationMin),
      'statsAggregate.lastSessionAt': serverTimestamp(),
    })
  })
}

/** Realtime recent focus sessions (for analytics). */
export function subscribeToSessions(uid, callback, max = 300) {
  const q = query(
    collection(db, 'users', uid, 'focusSessions'),
    orderBy('startedAt', 'desc'),
    limit(max),
  )
  return onSnapshot(q, (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  )
}
