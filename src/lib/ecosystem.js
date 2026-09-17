/**
 * ecosystem.js — Pure Ecological Succession & Merit Progression Engine.
 *
 * Models a living ecosystem that evolves through 6 distinct ecological succession tiers
 * based on monthly focus volume and consistency.
 *
 * Deterministic: PRNG seeded by `uid + YYYY-MM` guarantees the same input produces
 * the exact same landscape layout.
 */

import { getIndianSeasonForMonth } from '@/lib/indianClimate'
import { computeVitality } from '@/lib/ecoVitality'

export const SUCCESSION_TIERS = [
  {
    tier: 0,
    level: 0,
    name: 'Bare Substrate',
    subtitle: 'Fresh Earth',
    badgeColor: '#a8a29e',
    minHours: 0,
    minConsistency: 0,
    waterType: 'none',
    elevation: 'flat',
    fauna: [],
    weather: 'plain',
    description: 'Freshly tilled fertile soil waiting for initial seeds to root.',
  },
  {
    tier: 1,
    level: 1,
    name: 'Pioneer Meadow',
    subtitle: 'Wildflower Glade',
    badgeColor: '#84cc16',
    minHours: 2,
    minDays: 2,
    minConsistency: 0.15,
    waterType: 'puddle',
    elevation: 'flat',
    fauna: ['bee', 'butterfly'],
    weather: 'clear_clouds',
    description: 'Pioneer grasses, wildflowers, and early pollinators.',
  },
  {
    tier: 2,
    level: 2,
    name: 'Shrubland',
    subtitle: 'Emerald Knoll',
    badgeColor: '#10b981',
    minHours: 6,
    minConsistency: 0.4,
    waterType: 'pond',
    elevation: 'hillock',
    fauna: ['rabbit', 'robin'],
    weather: 'light_rain',
    description: 'A clear freshwater pond, rolling hillock, and visiting critters.',
  },
  {
    tier: 3,
    level: 3,
    name: 'Young Forest',
    subtitle: 'Babbling Brook',
    badgeColor: '#06b6d4',
    minHours: 15,
    minConsistency: 0.55,
    waterType: 'stream',
    elevation: 'rolling_hills',
    fauna: ['deer', 'stork'],
    weather: 'nourishing_rain',
    description: 'A winding stream flowing through mixed woods and grassy hills.',
  },
  {
    tier: 4,
    level: 4,
    name: 'Mature Forest',
    subtitle: 'River Valley',
    badgeColor: '#3b82f6',
    minHours: 30,
    minConsistency: 0.7,
    waterType: 'river',
    elevation: 'rocky_peaks',
    fauna: ['fox', 'owl', 'firefly'],
    weather: 'seasonal_mist',
    description: 'A deep flowing river, elevated mountain ridges, and dense canopy.',
  },
  {
    tier: 5,
    level: 5,
    name: 'Climax Ecosystem',
    subtitle: 'Cascading Falls',
    badgeColor: '#8b5cf6',
    minHours: 50,
    minConsistency: 0.85,
    minStreak: 4,
    waterType: 'waterfall',
    elevation: 'cliffs_waterfall',
    fauna: ['eagle', 'apex_predator', 'migrating_flocks'],
    weather: 'dynamic_rainbows',
    description: 'A majestic waterfall cascading into a mountain lake with a full trophic web.',
  },
]

/**
 * Deterministic hash integer generator from a string seed.
 */
export function hashSeed(str = '') {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * Deterministic pseudo-random number in [0, 1) from an integer seed and index.
 */
export function seededRandom(seedInt, offset = 0) {
  const x = Math.sin(seedInt + offset * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Evaluates the succession tier earned for a given month's statistics.
 *
 * @param {object} stats
 * @param {number} [stats.totalMin=0] Total focus minutes in the month
 * @param {number} [stats.activeDays=0] Number of days with >=1 completed session
 * @param {number} [stats.daysElapsed=1] Number of days passed in the month
 * @param {number} [stats.currentStreak=0] Consecutive focus day streak
 * @returns {typeof SUCCESSION_TIERS[0]}
 */
export function evaluateSuccessionTier({
  totalMin = 0,
  activeDays = 0,
  daysElapsed = 1,
  currentStreak = 0,
} = {}) {
  const hours = totalMin / 60
  const elapsed = Math.max(1, daysElapsed)
  const consistency = Math.min(1.0, activeDays / elapsed)

  // Tier 5: >= 50h, consistency >= 0.85, streak >= 4
  if (hours >= 50 && consistency >= 0.85 && currentStreak >= 4) {
    return SUCCESSION_TIERS[5]
  }
  // Tier 4: >= 30h, consistency >= 0.70
  if (hours >= 30 && consistency >= 0.7) {
    return SUCCESSION_TIERS[4]
  }
  // Tier 3: >= 15h, consistency >= 0.55
  if (hours >= 15 && consistency >= 0.55) {
    return SUCCESSION_TIERS[3]
  }
  // Tier 2: >= 6h, consistency >= 0.40
  if (hours >= 6 && consistency >= 0.4) {
    return SUCCESSION_TIERS[2]
  }
  // Tier 1: >= 2h, activeDays >= 2
  if (hours >= 2 && activeDays >= 2) {
    return SUCCESSION_TIERS[1]
  }
  return SUCCESSION_TIERS[0]
}

/**
 * Calculates progress and remaining requirements to unlock the next succession tier.
 *
 * @param {object} stats
 * @param {number} [stats.totalMin=0]
 * @param {number} [stats.activeDays=0]
 * @param {number} [stats.daysElapsed=1]
 * @param {number} [stats.currentStreak=0]
 * @returns {{ nextTier: object|null, remainingHours: number, remainingDays: number, remainingStreak: number, hintText: string }}
 */
export function getNextTierRequirements({
  totalMin = 0,
  activeDays = 0,
  daysElapsed = 1,
  currentStreak = 0,
} = {}) {
  const currentTier = evaluateSuccessionTier({ totalMin, activeDays, daysElapsed, currentStreak })
  if (currentTier.level >= 5) {
    return {
      nextTier: null,
      remainingHours: 0,
      remainingDays: 0,
      remainingStreak: 0,
      hintText: 'Climax Ecosystem unlocked! Peak biome reached.',
    }
  }

  const nextTier = SUCCESSION_TIERS[currentTier.level + 1]
  const hours = totalMin / 60
  const remainingHours = Math.max(0, Number((nextTier.minHours - hours).toFixed(1)))
  const elapsed = Math.max(1, daysElapsed)
  const targetActiveDays = Math.ceil(nextTier.minConsistency * elapsed)
  const remainingDays = Math.max(
    0,
    (nextTier.minDays ? Math.max(nextTier.minDays, targetActiveDays) : targetActiveDays) - activeDays,
  )
  const remainingStreak = nextTier.minStreak ? Math.max(0, nextTier.minStreak - currentStreak) : 0

  let hintText
  if (remainingHours > 0 && remainingDays > 0) {
    hintText = `${remainingHours}h focus & ${remainingDays}d consistency to unlock ${nextTier.name}`
  } else if (remainingHours > 0) {
    hintText = `${remainingHours}h focus to unlock ${nextTier.name}`
  } else if (remainingDays > 0) {
    hintText = `${remainingDays} more active day${remainingDays > 1 ? 's' : ''} to unlock ${nextTier.name}`
  } else if (remainingStreak > 0) {
    hintText = `${remainingStreak} more streak day${remainingStreak > 1 ? 's' : ''} to reach ${nextTier.name}`
  } else {
    hintText = `Reach next focus milestone to unlock ${nextTier.name}`
  }

  return {
    nextTier,
    remainingHours,
    remainingDays,
    remainingStreak,
    hintText,
  }
}

/**
 * Pure derivation of a month's entire ecosystem descriptor.
 *
 * @param {object} params
 * @param {number} [params.totalMin=0]
 * @param {number} [params.activeDays=0]
 * @param {number} [params.daysElapsed=1]
 * @param {number} [params.daysSinceLast=0]
 * @param {number} [params.currentStreak=0]
 * @param {number} [params.month=0] Calendar month index (0=Jan, 11=Dec)
 * @param {number} [params.year=2026] Calendar year
 * @param {string} [params.uid='anonymous'] User identifier for deterministic seeding
 * @param {boolean} [params.isSealed=false]
 * @returns {object} Full ecosystem descriptor
 */
export function deriveMonthEcosystem({
  totalMin = 0,
  activeDays = 0,
  daysElapsed = 1,
  daysSinceLast = 0,
  currentStreak = 0,
  month = new Date().getMonth(),
  year = new Date().getFullYear(),
  uid = 'anon',
  isSealed = false,
} = {}) {
  const yyyyMm = `${year}-${String(month + 1).padStart(2, '0')}`
  const seedStr = `${uid}:${yyyyMm}`
  const seedNum = hashSeed(seedStr)

  const tier = evaluateSuccessionTier({
    totalMin,
    activeDays,
    daysElapsed,
    currentStreak,
  })

  const vitality = computeVitality({
    streak: currentStreak,
    activeDaysThisMonth: activeDays,
    daysElapsedInMonth: daysElapsed,
    daysSinceLastSession: daysSinceLast,
    isSealed,
  })

  const season = getIndianSeasonForMonth(month)

  // Terrain generation parameters (hydrology, elevation, and edge connectivity)
  // River enters at edge A and exits at edge B (for hex continuity)
  const riverEntryEdge = Math.floor(seededRandom(seedNum, 1) * 6) // 0..5
  const riverExitEdge = (riverEntryEdge + 3 + (seededRandom(seedNum, 2) > 0.5 ? 1 : 5)) % 6

  // Hill / mountain placement within hex
  const elevationCenter = {
    x: (seededRandom(seedNum, 3) - 0.5) * 0.6,
    z: (seededRandom(seedNum, 4) - 0.5) * 0.6,
    scale: 0.6 + seededRandom(seedNum, 5) * 0.4,
  }

  // Pre-generate ambient butterflies, bees, or birds
  const ambientFauna = []
  if (tier.tier >= 1 && vitality > 0.35) {
    ambientFauna.push({ type: 'butterfly', count: tier.tier >= 3 ? 3 : 2 })
  }
  if (tier.tier >= 2 && vitality > 0.4) {
    ambientFauna.push({ type: 'robin', count: 1 })
  }
  if (tier.tier >= 3 && vitality > 0.45) {
    ambientFauna.push({ type: 'deer', count: 1 })
  }
  if (tier.tier >= 4 && vitality > 0.5) {
    ambientFauna.push({ type: 'fox', count: 1 })
  }

  return {
    yyyyMm,
    year,
    month,
    seedNum,
    tier,
    nextTier: getNextTierRequirements({ totalMin, activeDays, daysElapsed, currentStreak }),
    vitality,
    season,
    isSealed,
    stats: {
      totalMin,
      totalHours: Number((totalMin / 60).toFixed(1)),
      activeDays,
      daysElapsed,
      consistencyPct: Math.round((activeDays / Math.max(1, daysElapsed)) * 100),
      currentStreak,
    },
    hydrology: {
      type: tier.waterType,
      name: tier.waterType === 'none' ? 'Meadow' : tier.waterType.replace('_', ' '),
      waterType: tier.waterType,
      riverEntryEdge,
      riverExitEdge,
      waterVolume: tier.waterType === 'none' ? 0 : vitality,
    },
    geomorphology: {
      type: tier.elevation,
      name: tier.elevation === 'flat' ? 'Flat' : tier.elevation.replace('_', ' '),
      elevationType: tier.elevation,
      elevationCenter,
    },
    fauna: {
      tierFauna: tier.fauna,
      ambient: ambientFauna,
    },
    weather: {
      type: tier.weather,
      isMonsoon: season.id === 'varsha',
      isWinter: season.id === 'shishir',
    },
  }
}
