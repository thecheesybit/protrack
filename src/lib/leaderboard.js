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
import { loadMonthRollups } from './ecoRollup'

const DAY_MS = 86400000

/**
 * Leaderboard opt-out is PAUSED: every user is on the public board and the
 * Settings → Privacy toggle is locked on. Flip to `true` to restore opt-out —
 * the stored `settings.leaderboardOptOut` flag is kept, not erased.
 */
export const LEADERBOARD_OPT_OUT_ENABLED = false

/** True only when opting out is allowed AND the user has opted out. */
export function isLeaderboardOptedOut(settings, optOutEnabled = LEADERBOARD_OPT_OUT_ENABLED) {
  return optOutEnabled && settings?.leaderboardOptOut === true
}

/**
 * Whether the one-time leaderboard disclosure must be shown (and publishing
 * held back until it is acknowledged). While opt-out is paused, users who had
 * previously opted out are re-notified before their forest is published.
 */
export function needsLeaderboardNotice(settings, optOutEnabled = LEADERBOARD_OPT_OUT_ENABLED) {
  if (!settings) return false
  if (isLeaderboardOptedOut(settings, optOutEnabled)) return false
  return settings.leaderboardNoticeSeen !== true || settings.leaderboardOptOut === true
}

/** Robustly resolve a session timestamp (Firestore Timestamp | Date | number | string) → ms. */
export function toMs(ts) {
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

/** Get canonical 'YYYY-MM' key for a date or timestamp. */
export function getMonthKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Get canonical 'YYYY-MM' key for the calendar month immediately preceding the given date. */
export function getPreviousMonthKey(date = new Date()) {
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date)
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return getMonthKey(d)
}

/** Format minutes into human-readable e.g. "50h 53m" or "25m". */
export function formatLeaderboardMinutes(min) {
  const m = Math.max(0, Math.round(Number(min) || 0))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? `${h}h ${r}m` : `${r}m`
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
 *   allTimeMin?: number, now?: number, maxForest?: number, uid?: string,
 *   championBadges?: Array<object>,
 * }} [opts]
 * @returns {object} display-safe leaderboard payload (no PII beyond display name/photo)
 */
export function buildLeaderboardEntry(
  sessions,
  {
    displayName,
    photoURL = null,
    currentStreak = 0,
    allTimeMin = 0,
    now = Date.now(),
    maxForest = 120,
    uid = 'default',
    championBadges = [],
  } = {},
) {
  const weekStart = now - 7 * DAY_MS
  const nowDate = new Date(now)
  const curYear = nowDate.getFullYear()
  const curMonth = nowDate.getMonth()
  const monthKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`

  const prevDate = new Date(curYear, curMonth - 1, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth()
  const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`

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

  const lastMonthly = completed
    .filter((x) => {
      const d = new Date(x.ms)
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth
    })
    .map(toEntry)

  const sumMin = (arr) => arr.reduce((acc, e) => acc + e.min, 0)
  // Cap the stored forest arrays (newest kept) so the doc stays tiny.
  const capForest = (arr) =>
    arr.slice(Math.max(0, arr.length - maxForest)).map((e) => ({ t: e.type, s: e.seed }))

  // Check sealed rollup if available for last month (fallback when sessions > 300 aged out)
  const rollups = typeof loadMonthRollups === 'function' ? loadMonthRollups(uid) : {}
  const prevRollup = rollups?.[prevMonthKey]

  const lastMonthPayload = {
    monthKey: prevMonthKey,
    monthlyMin: sumMin(lastMonthly) || (prevRollup?.totalMin || 0),
    monthlyTrees: countType(lastMonthly, 'tree') || (prevRollup?.counts?.trees || 0),
    monthlyShrubs: countType(lastMonthly, 'shrub') || (prevRollup?.counts?.shrubs || 0),
    monthlyFlowers: countType(lastMonthly, 'flower') || (prevRollup?.counts?.flowers || 0),
    monthlyForest: lastMonthly.length > 0 ? capForest(lastMonthly) : (prevRollup?.miniItems || []),
  }

  return {
    displayName: String(displayName || 'Explorer').slice(0, 40),
    photoURL: photoURL || null,
    monthKey,
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
    lastMonth: lastMonthPayload,
    championBadges: Array.isArray(championBadges) ? championBadges : [],
  }
}

/**
 * Whether the inputs are complete enough to publish. Publishing before the
 * focus-session listener delivers would push 0 weekly/monthly minutes (with the
 * correct all-time total, which comes from stats) over a good entry — so wait
 * for stats, for the listener, and never publish an empty session list for a
 * user whose stats say they have focus history.
 */
export function isLeaderboardDataReady({ sessions, sessionsLoading, stats }) {
  if (sessionsLoading || !stats || !Array.isArray(sessions)) return false
  if (sessions.length === 0 && (Number(stats.totalFocusMin) || 0) > 0) return false
  return true
}

/**
 * Write-coalescing signature for an entry. Includes the local day and monthKey
 * so every device republishes at least once a day and immediately upon rolling
 * over into a new month.
 */
export function leaderboardSignature(uid, entry, day) {
  return JSON.stringify([
    uid,
    day,
    entry.monthKey,
    entry.displayName,
    entry.photoURL,
    entry.weeklyMin,
    entry.monthlyMin,
    entry.lastMonth?.monthlyMin,
    entry.allTimeMin,
    entry.currentStreak,
    entry.weeklyForest?.length || 0,
    entry.monthlyForest?.length || 0,
    (entry.championBadges || []).length,
  ])
}

/**
 * Normalizes raw Firestore leaderboard documents against a reference time.
 * Handles month roll-overs and archival:
 * 1. Current month data resets for any user who hasn't completed sessions in the current month.
 * 2. Last month data is preserved (either from explicit `lastMonth` or legacy docs published in the previous month).
 * 3. Weekly minutes decay to 0 if an entry hasn't been updated in > 7 days.
 * 4. Resolves the champion of last month (#1 ranked by lastMonthMin) and decorates badges.
 */
export function resolveLeaderboard(rawEntries = [], { now = Date.now(), userUid = null } = {}) {
  const nowDate = new Date(now)
  const curYear = nowDate.getFullYear()
  const curMonth = nowDate.getMonth()
  const curMonthKey = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`
  const curMonthLabel = nowDate.toLocaleDateString([], { month: 'long', year: 'numeric' })

  const prevDate = new Date(curYear, curMonth - 1, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth()
  const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`
  const prevMonthLabel = prevDate.toLocaleDateString([], { month: 'long', year: 'numeric' })
  const prevMonthShort = `${prevDate.toLocaleDateString([], { month: 'short' })} '${String(prevYear).slice(-2)}` // e.g. "Sep '26"

  const normalized = (rawEntries || []).map((doc) => {
    const uid = doc.uid || doc.id
    const updatedMs = toMs(doc.updatedAt)

    // Infer published month key if missing (legacy doc fallback)
    let docMonthKey = doc.monthKey
    if (!docMonthKey) {
      if (updatedMs) {
        const ud = new Date(updatedMs)
        docMonthKey = `${ud.getFullYear()}-${String(ud.getMonth() + 1).padStart(2, '0')}`
      } else {
        docMonthKey = prevMonthKey
      }
    }

    // Weekly decay: older than 7 days decays to 0
    const isWeeklyStale = updatedMs ? now - updatedMs > 7 * DAY_MS : false
    const weeklyMin = isWeeklyStale ? 0 : Number(doc.weeklyMin) || 0
    const weeklyTrees = isWeeklyStale ? 0 : Number(doc.weeklyTrees) || 0
    const weeklyShrubs = isWeeklyStale ? 0 : Number(doc.weeklyShrubs) || 0
    const weeklyFlowers = isWeeklyStale ? 0 : Number(doc.weeklyFlowers) || 0
    const weeklyForest = isWeeklyStale ? [] : doc.weeklyForest || []

    // Current month evaluation:
    // If doc was published in current month, take current data; otherwise it has reset to 0!
    const isCurrentMonthPublished = docMonthKey === curMonthKey
    const monthlyMin = isCurrentMonthPublished ? Number(doc.monthlyMin) || 0 : 0
    const monthlyTrees = isCurrentMonthPublished ? Number(doc.monthlyTrees) || 0 : 0
    const monthlyShrubs = isCurrentMonthPublished ? Number(doc.monthlyShrubs) || 0 : 0
    const monthlyFlowers = isCurrentMonthPublished ? Number(doc.monthlyFlowers) || 0 : 0
    const monthlyForest = isCurrentMonthPublished ? doc.monthlyForest || [] : []

    // Last month evaluation:
    // If doc was published in current month, read doc.lastMonth
    // If doc was published in prev month, doc's top-level monthly fields ARE the prev month data!
    let lastMonthMin = 0
    let lastMonthTrees = 0
    let lastMonthShrubs = 0
    let lastMonthFlowers = 0
    let lastMonthForest = []

    if (isCurrentMonthPublished) {
      if (doc.lastMonth && doc.lastMonth.monthKey === prevMonthKey) {
        lastMonthMin = Number(doc.lastMonth.monthlyMin) || 0
        lastMonthTrees = Number(doc.lastMonth.monthlyTrees) || 0
        lastMonthShrubs = Number(doc.lastMonth.monthlyShrubs) || 0
        lastMonthFlowers = Number(doc.lastMonth.monthlyFlowers) || 0
        lastMonthForest = doc.lastMonth.monthlyForest || []
      }
    } else if (docMonthKey === prevMonthKey) {
      lastMonthMin = Number(doc.monthlyMin) || 0
      lastMonthTrees = Number(doc.monthlyTrees) || 0
      lastMonthShrubs = Number(doc.monthlyShrubs) || 0
      lastMonthFlowers = Number(doc.monthlyFlowers) || 0
      lastMonthForest = doc.monthlyForest || []
    }

    return {
      ...doc,
      uid,
      id: doc.id || uid,
      displayName: doc.displayName || 'Explorer',
      photoURL: doc.photoURL || null,
      currentStreak: Number(doc.currentStreak) || 0,
      allTimeMin: Number(doc.allTimeMin) || 0,
      // Fresh weekly
      weeklyMin,
      weeklyTrees,
      weeklyShrubs,
      weeklyFlowers,
      weeklyForest,
      // Fresh current month (e.g. October)
      monthlyMin,
      monthlyTrees,
      monthlyShrubs,
      monthlyFlowers,
      monthlyForest,
      // Preserved last month (e.g. September)
      lastMonthMin,
      lastMonthTrees,
      lastMonthShrubs,
      lastMonthFlowers,
      lastMonthForest,
      championBadges: Array.isArray(doc.championBadges) ? [...doc.championBadges] : [],
    }
  })

  // Determine last month's champion (#1 with > 0 minutes)
  const sortedLastMonth = [...normalized].sort((a, b) => b.lastMonthMin - a.lastMonthMin)
  const topCandidate = sortedLastMonth[0]
  const champion =
    topCandidate && topCandidate.lastMonthMin > 0
      ? {
          uid: topCandidate.uid,
          displayName: topCandidate.displayName,
          photoURL: topCandidate.photoURL,
          monthlyMin: topCandidate.lastMonthMin,
          trees: topCandidate.lastMonthTrees,
          monthKey: prevMonthKey,
          monthLabel: prevMonthLabel,
          shortLabel: prevMonthShort,
        }
      : null

  // Decorate champion flags and badges
  const entries = normalized.map((e) => {
    const isChampion = Boolean(champion && champion.uid === e.uid)
    const hasChampionBadge = isChampion || e.championBadges.some((b) => b.monthKey === prevMonthKey)
    const badge = hasChampionBadge
      ? {
          id: `champ_${prevMonthKey}`,
          monthKey: prevMonthKey,
          label: `${prevMonthShort} Champion`,
          fullLabel: `${prevMonthLabel} Monthly Champion`,
          tooltip: `${prevMonthLabel} Monthly Champion · ${champion?.uid === e.uid ? formatLeaderboardMinutes(champion.monthlyMin) : 'Winner'} focused`,
        }
      : null

    const allBadges = [...e.championBadges]
    if (badge && !allBadges.some((b) => b.monthKey === prevMonthKey)) {
      allBadges.unshift(badge)
    }

    return {
      ...e,
      isLastMonthChampion: isChampion,
      championBadge: badge,
      allBadges,
    }
  })

  const isUserChampion = Boolean(userUid && champion && champion.uid === userUid)

  return {
    currentMonthKey: curMonthKey,
    currentMonthLabel: curMonthLabel,
    lastMonthKey: prevMonthKey,
    lastMonthLabel: prevMonthLabel,
    lastMonthShort: prevMonthShort,
    champion,
    isUserChampion,
    entries,
  }
}

