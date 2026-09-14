import {
  collection,
  addDoc,
  doc,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { ymd, computeStreak } from '@/lib/dates'

/**
 * Record a completed focus session and atomically roll up the gamification
 * stats (total minutes, trees/shrubs/flowers, active days, streak, longest
 * session).
 *
 * `plantings` (from {@link module:lib/plantGrowth.computePlantings}) is an
 * array of `{ type, durationMin }` — one tree per full 25-minute block plus at
 * most one capped shrub/flower remainder, so a long session plants several
 * `focusSessions` docs in one batched write. All forest views already render
 * one foliage sprite per doc, so N plantings = N sprites with no rendering
 * changes needed. `durationMin` (the session total) is still recorded
 * separately for streak/stat purposes. Falls back to a single legacy planting
 * when `plantings` isn't provided.
 */
export async function logFocusSession(uid, { modeId, subjectId, slotId, targetDate, label, color, plantings, durationMin, plantType, startedAt, hourOfDay }) {
  const resolvedPlantings =
    plantings && plantings.length > 0
      ? plantings
      : [{ type: plantType || (durationMin < 10 ? 'flower' : durationMin <= 15 ? 'shrub' : 'tree'), durationMin }]

  const sessionsCol = collection(db, 'users', uid, 'focusSessions')
  const batch = writeBatch(db)
  for (const planting of resolvedPlantings) {
    batch.set(doc(sessionsCol), {
      modeId: modeId || null,
      subjectId: subjectId || null,
      slotId: slotId || null,
      targetDate: targetDate || null,
      label: label || null,
      title: label || null,
      color: color || null,
      durationMin: planting.durationMin,
      plantType: planting.type,
      completed: true,
      hourOfDay,
      startedAt: startedAt || serverTimestamp(),
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()

  const totalMin = durationMin ?? resolvedPlantings.reduce((sum, p) => sum + p.durationMin, 0)
  const treeCount = resolvedPlantings.filter((p) => p.type === 'tree').length
  const shrubCount = resolvedPlantings.filter((p) => p.type === 'shrub').length
  const flowerCount = resolvedPlantings.filter((p) => p.type === 'flower').length

  const ref = doc(db, 'users', uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const stats = snap.data()?.statsAggregate || {}
    const today = ymd()
    const activeDays = stats.activeDays?.includes(today)
      ? stats.activeDays
      : [...(stats.activeDays || []), today]
    tx.update(ref, {
      'statsAggregate.totalFocusMin': (stats.totalFocusMin || 0) + totalMin,
      'statsAggregate.treesGrown': (stats.treesGrown || 0) + treeCount,
      'statsAggregate.shrubsGrown': (stats.shrubsGrown || 0) + shrubCount,
      'statsAggregate.flowersGrown': (stats.flowersGrown || 0) + flowerCount,
      'statsAggregate.activeDays': activeDays,
      'statsAggregate.currentStreak': computeStreak(activeDays),
      'statsAggregate.longestSessionMin': Math.max(stats.longestSessionMin || 0, totalMin),
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

/**
 * One-shot recent-sessions fetch — same bounded, no-composite-index shape as
 * {@link subscribeToSessions} (order+limit only, filtered client-side), used
 * by the daily topic-mapping AI batch (useTopicMappingBatch) instead of a
 * standing listener.
 */
export async function getRecentSessionsOnce(uid, max = 200) {
  const q = query(
    collection(db, 'users', uid, 'focusSessions'),
    orderBy('startedAt', 'desc'),
    limit(max),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Record a failed focus session. */
export async function logFailedFocusSession(uid, { modeId, subjectId, startedAt }) {
  await addDoc(collection(db, 'users', uid, 'focusSessions'), {
    modeId: modeId || null,
    subjectId: subjectId || null,
    durationMin: 0,
    completed: false,
    failedReason: 'plant died/was not planted successfully',
    startedAt: startedAt || serverTimestamp(),
    createdAt: serverTimestamp(),
  })
}
