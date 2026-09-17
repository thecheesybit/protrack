/**
 * ecoRollup.js — Sealed Historical Month Rollups & Permanent Preservation Store.
 *
 * ARCHITECTURAL GUARANTEE:
 * 1. Bounded sliding read cap safety:
 *    `useFocusSessions` only subscribes to the 300 most recent sessions. As time passes,
 *    historical sessions fall out of this window. To prevent past months from drifting
 *    or silently degrading ("bare plot" degradation), sealed months are permanently
 *    persisted to localStorage (`protrack:forest_months:${uid}`).
 * 2. Sealed immutability:
 *    Once a calendar month ends, its stats (focus minutes, active days, tier, frozen vitality,
 *    and representative flora seeds) are sealed. Sealed months read from this snapshot
 *    and NEVER recompute from the live sliding session window.
 * 3. Spark-Safe:
 *    100% localStorage + memory caching. Zero Firestore writes or listeners.
 * 4. Private-mode resilience:
 *    Full try/catch with in-memory fallback so restricted storage environments never crash.
 */

import { deriveMonthEcosystem } from './ecosystem'
import { computeSealedVitality } from './ecoVitality'

const ROLLUP_KEY_PREFIX = 'protrack:forest_months:'

// In-memory fallback cache for private/incognito windows or SSR
const memoryCache = new Map()

/**
 * Returns true if the given calendar year and month are in the past and thus sealed.
 * @param {number} year
 * @param {number} month Calendar month index (0=Jan, 11=Dec)
 */
export function isMonthSealed(year, month) {
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth()
  return year < curYear || (year === curYear && month < curMonth)
}

/**
 * Safely loads all sealed month rollups for a user.
 * @param {string} [uid='default']
 * @returns {Record<string, object>} Map of 'YYYY-MM' -> MonthRollup
 */
export function loadMonthRollups(uid = 'default') {
  const key = `${ROLLUP_KEY_PREFIX}${uid}`
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryCache.get(key) || {}
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return memoryCache.get(key) || {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (err) {
    console.warn('[ecoRollup] Failed to read localStorage, falling back to memory cache:', err)
    return memoryCache.get(key) || {}
  }
}

/**
 * Safely saves sealed month rollups for a user.
 * @param {string} uid
 * @param {Record<string, object>} rollups
 */
export function saveAllMonthRollups(uid = 'default', rollups = {}) {
  const key = `${ROLLUP_KEY_PREFIX}${uid}`
  memoryCache.set(key, rollups)

  if (typeof window === 'undefined' || !window.localStorage) return

  try {
    window.localStorage.setItem(key, JSON.stringify(rollups))
  } catch (err) {
    console.warn('[ecoRollup] Failed to write localStorage:', err)
  }
}

/**
 * Saves or updates a single sealed month rollup.
 * @param {string} uid
 * @param {string} monthKey 'YYYY-MM'
 * @param {object} rollupData
 */
export function saveMonthRollup(uid = 'default', monthKey, rollupData) {
  if (!monthKey) return
  const current = loadMonthRollups(uid)
  current[monthKey] = {
    ...rollupData,
    key: monthKey,
    updatedAt: new Date().toISOString(),
  }
  saveAllMonthRollups(uid, current)
}

/**
 * Seals a past month and returns its permanent rollup snapshot.
 *
 * @param {object} params
 * @param {string} [params.uid='default']
 * @param {number} params.year
 * @param {number} params.month 0..11
 * @param {number} [params.totalMin=0]
 * @param {number} [params.activeDays=0]
 * @param {Array} [params.monthSessions=[]]
 * @param {number} [params.currentStreak=0]
 * @returns {object} Sealed MonthRollup
 */
export function sealMonth({
  uid = 'default',
  year,
  month,
  totalMin = 0,
  activeDays = 0,
  monthSessions = [],
  currentStreak = 0,
}) {
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysElapsed = daysInMonth

  // Derive final sealed ecosystem descriptor
  const ecosystem = deriveMonthEcosystem({
    totalMin,
    activeDays,
    daysElapsed,
    daysSinceLast: 0,
    currentStreak,
    month,
    year,
    uid,
    isSealed: true,
  })

  // Frozen vitality based on month-end consistency
  const vitalityAtSeal = computeSealedVitality({
    activeDays,
    totalDaysInMonth: daysInMonth,
  })

  // Count flora types
  let trees = 0
  let shrubs = 0
  let flowers = 0
  for (const s of monthSessions) {
    const dur = Number(s.durationMin) || 0
    if (dur >= 15) trees++
    else if (dur >= 10) shrubs++
    else flowers++
  }

  // Compact representative flora seeds for miniature world map rendering (capped to 24)
  const miniItems = monthSessions.slice(0, 24).map((s, i) => {
    const dur = Number(s.durationMin) || 0
    const type = dur >= 15 ? 'tree' : dur >= 10 ? 'shrub' : 'flower'
    return {
      type,
      seed: i * 7,
    }
  })

  const rollup = {
    key: monthKey,
    year,
    month,
    totalMin,
    totalHours: Number((totalMin / 60).toFixed(1)),
    activeDays,
    daysInMonth,
    tier: ecosystem.tier,
    vitality: vitalityAtSeal,
    vitalityAtSeal,
    ecosystem: {
      ...ecosystem,
      vitality: vitalityAtSeal,
      isSealed: true,
    },
    counts: {
      trees,
      shrubs,
      flowers,
      total: monthSessions.length,
    },
    miniItems,
    sealedAt: new Date().toISOString(),
    isSealed: true,
  }

  saveMonthRollup(uid, monthKey, rollup)
  return rollup
}
