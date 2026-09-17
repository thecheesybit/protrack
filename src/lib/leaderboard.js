/**
 * Pure builder for a user's public leaderboard entry.
 *
 * PRO TRACK is owner-only on the Firebase Spark plan, so the leaderboard works
 * by each client publishing ONLY its own display-safe aggregate to a
 * world-readable `leaderboard/{uid}` collection (same pattern as the Wall of
 * Honor). This module turns the signed-in user's focus sessions into that
 * display-safe payload — names, focus minutes, plant counts, streak, and a
 * compact forest snapshot. It NEVER touches subjects, todos, scores, or any
 * other private data.
 *
 * Pure and deterministic (inject `now`) so it is fully unit-testable.
 */

import { getPlantTypeForDuration } from './plantGrowth'

const DAY_MS = 86400000

/** Robustly resolve a session timestamp (Firestore Timestamp | Date | number | string) → ms. */
function toMs(ts) {
  if (ts == null) return null
  try {
    if (typeof ts.toMillis === 'function') return ts.toMillis()
    if (typeof ts.toDate === 'function') return ts.toDate().getTime()
    if (typeof ts.seconds === 'number') return ts.seconds * 1000
    const d = new Date(ts)
    const t = d.getTime()
    return isNaN(t) ? null : t
  } catch {
    return null
  }
}

/** Small deterministic string hash → non-negative int (sprite seed for the snapshot). */
function hashSeed(str) {
  let hash = 0
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function countType(entries, type) {
  return entries.filter((e) => e.type === type).length
}

/**
 * @param {Array<object>} sessions the user's focus session docs (recent, bounded)
 * @param {{
 *   displayName?: string, photoURL?: string|null, currentStreak?: number,
 *   allTimeMin?: number, now?: number, maxForest?: number,
 * }} [opts]
 * @returns {object} display-safe leaderboard payload (no PII beyond display name/photo)
 */
export function buildLeaderboardEntry(
  sessions,
  { displayName, photoURL = null, currentStreak = 0, allTimeMin = 0, now = Date.now(), maxForest = 120 } = {},
) {
  const weekStart = now - 7 * DAY_MS
  const nowDate = new Date(now)
  const curYear = nowDate.getFullYear()
  const curMonth = nowDate.getMonth()

  // Completed sessions with a resolvable timestamp, oldest-first.
  const completed = (sessions || [])
    .filter((s) => s && s.completed !== false && !s.failedReason && (Number(s.durationMin) || 0) > 0)
    .map((s) => ({ s, ms: toMs(s.startedAt || s.createdAt) }))
    .filter((x) => x.ms != null)
    .sort((a, b) => a.ms - b.ms)

  const toEntry = (x, i) => ({
    type: getPlantTypeForDuration(x.s.plantType, Number(x.s.durationMin) || 0),
    // Compact forest snapshot: type + a stable sprite seed.
    seed:
      typeof x.s.spriteVariant === 'number'
        ? Math.abs(x.s.spriteVariant)
        : hashSeed(x.s.id || x.ms || i),
    min: Number(x.s.durationMin) || 0,
  })

  const weekly = completed.filter((x) => x.ms >= weekStart).map(toEntry)
  const monthly = completed
    .filter((x) => {
      const d = new Date(x.ms)
      return d.getFullYear() === curYear && d.getMonth() === curMonth
    })
    .map(toEntry)

  const sumMin = (arr) => arr.reduce((acc, e) => acc + e.min, 0)
  // Cap the stored forest arrays (newest kept) so the doc stays tiny.
  const capForest = (arr) =>
    arr.slice(Math.max(0, arr.length - maxForest)).map((e) => ({ t: e.type, s: e.seed }))

  return {
    displayName: String(displayName || 'Explorer').slice(0, 40),
    photoURL: photoURL || null,
    weeklyMin: sumMin(weekly),
    monthlyMin: sumMin(monthly),
    allTimeMin: Math.round(Number(allTimeMin) || 0),
    weeklyTrees: countType(weekly, 'tree'),
    weeklyShrubs: countType(weekly, 'shrub'),
    weeklyFlowers: countType(weekly, 'flower'),
    monthlyTrees: countType(monthly, 'tree'),
    monthlyShrubs: countType(monthly, 'shrub'),
    monthlyFlowers: countType(monthly, 'flower'),
    currentStreak: Math.round(Number(currentStreak) || 0),
    weeklyForest: capForest(weekly),
    monthlyForest: capForest(monthly),
  }
}
