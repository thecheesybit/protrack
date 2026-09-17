/**
 * forestWorld.js — Honeycomb World Map & Multi-Month Hex Continent.
 *
 * Groups user focus history by month into interlocking hexagonal land tiles.
 * Hexes are laid out in a continuous spiral honeycomb so each month sits adjacent
 * to the previous, forming a coherent continent over the year.
 *
 * Free-tier Spark discipline: 100% pure derivation, zero Firestore queries.
 */

import { deriveMonthEcosystem } from '@/lib/ecosystem'
import { loadMonthRollups, sealMonth, isMonthSealed } from '@/lib/ecoRollup'

function parseDate(ts) {
  if (!ts) return null
  try {
    if (typeof ts.toDate === 'function') return ts.toDate()
    const d = new Date(ts)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/**
 * Generates axial hex coordinates (q, r) for an outward spiral honeycomb.
 * Guarantees each index is directly adjacent to or contiguous with its predecessor.
 *
 * Ring 0: (0, 0)
 * Ring 1 (6 hexes): (1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)
 * Ring 2 (12 hexes)...
 */
const DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

const spiralCache = [{ q: 0, r: 0 }]

function ensureSpiralCache(targetIndex) {
  let ring = 1
  while (spiralCache.length <= targetIndex) {
    let currQ = DIRECTIONS[4].q * ring
    let currR = DIRECTIONS[4].r * ring
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < ring; j++) {
        spiralCache.push({ q: currQ, r: currR })
        currQ += DIRECTIONS[i].q
        currR += DIRECTIONS[i].r
      }
    }
    ring++
  }
}

export function getSpiralHexCoord(index) {
  if (index <= 0) return { q: 0, r: 0 }
  ensureSpiralCache(index)
  return spiralCache[index]
}

/**
 * Converts axial hex coordinates (q, r) to 2D isometric pixel offsets.
 * For pointy-topped hexes:
 *   x = R * sqrt(3) * (q + r / 2)
 *   y = R * 1.5 * r * sinPitch
 *
 * @param {number} q
 * @param {number} r
 * @param {number} R Hex circumradius
 * @param {number} sinPitch Projection vertical foreshortening
 */
export function hexToPixel(q, r, R = 100, sinPitch = 0.5236) {
  const sqrt3 = Math.sqrt(3)
  const px = R * sqrt3 * (q + r / 2)
  const py = R * 1.5 * r * sinPitch
  return { px, py }
}

/**
 * Groups sessions by `YYYY-MM` month string.
 */
export function groupSessionsByMonth(sessions = []) {
  const map = new Map()

  for (const s of sessions) {
    if (!s || s.completed === false || s.failedReason) continue
    if (s.durationMin !== undefined && s.durationMin <= 0) continue

    const d = parseDate(s.startedAt || s.createdAt)
    if (!d) continue

    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${yyyy}-${mm}`

    if (!map.has(key)) {
      map.set(key, {
        key,
        year: yyyy,
        month: d.getMonth(),
        sessions: [],
        activeDaysSet: new Set(),
        totalMin: 0,
        lastSessionDate: null,
      })
    }

    const m = map.get(key)
    m.sessions.push(s)
    m.activeDaysSet.add(d.getDate())
    m.totalMin += Number(s.durationMin) || 0

    if (!m.lastSessionDate || d > m.lastSessionDate) {
      m.lastSessionDate = d
    }
  }

  return map
}

/**
 * Derives the complete World Continent of month-hexes.
 *
 * GUARANTEES:
 * 1. Read-Cap Resilience (A1):
 *    Historical months are preserved via sealed rollups. If past sessions fall out
 *    of the 300-session Firestore window, sealed rollups guarantee they never degrade.
 * 2. Sealed Immutability (A2):
 *    Past months use frozen vitality and ecosystems sealed at month-end.
 * 3. Continuous Honeycomb Geography (A3):
 *    Gap/dormant months are preserved as "Tier 0 · Bare Substrate" hexes so indices
 *    remain strictly continuous, adjacent hex neighbors stay intact, and history is unbroken.
 *
 * @param {Array} sessions All user focus sessions
 * @param {object} options
 * @param {string} [options.uid='anon'] User ID
 * @param {Date} [options.now=new Date()] Current reference date
 * @param {number} [options.currentStreak=0] Active day streak
 * @returns {Array<object>} Ordered array of month-hex world tiles
 */
export function deriveWorldHexes(sessions = [], { uid = 'anon', now = new Date(), currentStreak = 0 } = {}) {
  const currentY = now.getFullYear()
  const currentM = now.getMonth()
  const currentKey = `${currentY}-${String(currentM + 1).padStart(2, '0')}`

  // 1. Load permanently sealed rollups from localStorage / cache
  const rollups = loadMonthRollups(uid)

  // 2. Group available sessions from live window
  const sessionMap = groupSessionsByMonth(sessions)

  // 3. Auto-seal any past months present in sessionMap that haven't been sealed yet
  for (const m of sessionMap.values()) {
    if (isMonthSealed(m.year, m.month) && !rollups[m.key]) {
      const sealed = sealMonth({
        uid,
        year: m.year,
        month: m.month,
        totalMin: m.totalMin,
        activeDays: m.activeDaysSet.size,
        monthSessions: m.sessions,
        currentStreak: 0,
      })
      rollups[m.key] = sealed
    }
  }

  // 4. Find all known month keys (rollups + sessions + currentKey)
  const allKnownKeys = new Set([
    ...Object.keys(rollups),
    ...Array.from(sessionMap.keys()),
    currentKey,
  ])

  const sortedKeys = Array.from(allKnownKeys).sort()
  const earliestKey = sortedKeys[0] || currentKey

  // Bound historical span to at most 24 months before current to avoid excessive loops
  const [minY, minM] = earliestKey.split('-').map(Number)
  const totalMonthsDiff = (currentY - minY) * 12 + (currentM - (minM - 1))
  const boundedMonthsDiff = Math.min(24, Math.max(0, totalMonthsDiff))

  const startDate = new Date(currentY, currentM - boundedMonthsDiff, 1)
  const startY = startDate.getFullYear()
  const startM = startDate.getMonth()

  // 5. Generate continuous chronological sequence from start to currentKey
  const hexes = []
  let iterDate = new Date(startY, startM, 1)
  let index = 0

  while (
    iterDate.getFullYear() < currentY ||
    (iterDate.getFullYear() === currentY && iterDate.getMonth() <= currentM)
  ) {
    const y = iterDate.getFullYear()
    const m = iterDate.getMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const isCurrent = key === currentKey
    const { q, r } = getSpiralHexCoord(index)

    if (isCurrent) {
      // Living active month
      const sData = sessionMap.get(key)
      const totalMin = sData?.totalMin || 0
      const activeDays = sData?.activeDaysSet?.size || 0
      const monthSessions = sData?.sessions || []
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const daysElapsed = Math.min(daysInMonth, now.getDate())

      const lastSession = monthSessions[monthSessions.length - 1]
      const lastDate = lastSession ? parseDate(lastSession.startedAt || lastSession.createdAt) : null
      const daysSinceLast = lastDate
        ? Math.max(0, Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)))
        : now.getDate()

      const ecosystem = deriveMonthEcosystem({
        totalMin,
        activeDays,
        daysElapsed,
        daysSinceLast,
        currentStreak,
        month: m,
        year: y,
        uid,
        isSealed: false,
      })

      const miniItems = monthSessions.slice(0, 24).map((s, idx) => {
        const dur = Number(s.durationMin) || 0
        const type = dur >= 15 ? 'tree' : dur >= 10 ? 'shrub' : 'flower'
        return { type, seed: idx * 7 }
      })

      hexes.push({
        key,
        year: y,
        month: m,
        index,
        q,
        r,
        isCurrent: true,
        isSealed: false,
        isDormant: false,
        sessionCount: monthSessions.length,
        sessions: monthSessions,
        ecosystem,
        activeDaysCount: activeDays,
        totalHours: Number((totalMin / 60).toFixed(1)),
        miniItems,
      })
    } else {
      // Sealed past month
      const rollup = rollups[key]
      const sData = sessionMap.get(key)

      if (rollup && (rollup.counts?.total > 0 || rollup.totalMin > 0)) {
        // Read directly from frozen sealed rollup snapshot
        hexes.push({
          key,
          year: y,
          month: m,
          index,
          q,
          r,
          isCurrent: false,
          isSealed: true,
          isDormant: false,
          sessionCount: rollup.counts?.total ?? (sData?.sessions?.length || 0),
          sessions: sData?.sessions || [],
          ecosystem: rollup.ecosystem,
          activeDaysCount: rollup.activeDays,
          totalHours: rollup.totalHours,
          miniItems: rollup.miniItems || [],
        })
      } else if (sData && sData.sessions.length > 0) {
        // Unsealed past month with sessions
        const sealed = sealMonth({
          uid,
          year: y,
          month: m,
          totalMin: sData.totalMin,
          activeDays: sData.activeDaysSet.size,
          monthSessions: sData.sessions,
          currentStreak: 0,
        })
        rollups[key] = sealed

        hexes.push({
          key,
          year: y,
          month: m,
          index,
          q,
          r,
          isCurrent: false,
          isSealed: true,
          isDormant: false,
          sessionCount: sealed.counts.total,
          sessions: sData.sessions,
          ecosystem: sealed.ecosystem,
          activeDaysCount: sealed.activeDays,
          totalHours: sealed.totalHours,
          miniItems: sealed.miniItems || [],
        })
      } else {
        // Gap A3: Empty/dormant month in the past
        // Renders as Tier 0 Bare Substrate to keep spiral continuous
        const dormantEcosystem = {
          tier: {
            level: 0,
            tier: 0,
            name: 'Bare Substrate',
            description: 'Quiet dormant earth resting peacefully.',
            badgeColor: '#78716c',
          },
          vitality: 0.25,
          hydrology: { type: 'none', name: 'Arid Soil' },
          geomorphology: { type: 'flat', name: 'Flat Bed' },
          climate: { season: { name: 'Dormant' }, precipitation: 'arid' },
          flora: { density: 0, canopies: [] },
          isSealed: true,
          isDormant: true,
        }

        hexes.push({
          key,
          year: y,
          month: m,
          index,
          q,
          r,
          isCurrent: false,
          isSealed: true,
          isDormant: true,
          sessionCount: 0,
          sessions: [],
          ecosystem: dormantEcosystem,
          activeDaysCount: 0,
          totalHours: 0,
          miniItems: [],
        })
      }
    }

    index++
    iterDate = new Date(y, m + 1, 1)
  }

  return hexes
}
