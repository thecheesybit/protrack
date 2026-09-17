/**
 * ecoVitality.js — Pure Vitality & Ecosystem Health Derivation.
 *
 * HARD CONSTRAINT:
 * Never deletes or alters real focusSessions records. Planted flora are the user's
 * actual historical achievement. Vitality (0.15..1.0) is a purely derived, cosmetic
 * health layer:
 *  - High vitality (0.80..1.00): Vibrant emerald foliage, clear water, lively fauna.
 *  - Medium vitality (0.50..0.79): Normal temperate growth.
 *  - Low vitality (0.15..0.49): Warm parched/savannah tint, leaf shedding, lower water levels.
 *
 * When a user completes a focus session today, vitality immediately recovers to full health.
 */

/**
 * Derives a normalized vitality score between 0.15 and 1.0.
 *
 * @param {object} params
 * @param {number} [params.streak=0] Consecutive-day streak
 * @param {number} [params.activeDaysThisMonth=0] Days with >= 1 completed session this month
 * @param {number} [params.daysElapsedInMonth=1] Number of days passed in the target month
 * @param {number} [params.daysSinceLastSession=0] Days since most recent focus session
 * @param {boolean} [params.isSealed=false] Whether this month is already finished & sealed
 * @returns {number} Vitality in [0.15, 1.0]
 */

/**
 * Computes a frozen vitality score for a completed, sealed month based purely
 * on that month's final consistency.
 *
 * @param {object} params
 * @param {number} [params.activeDays=0]
 * @param {number} [params.totalDaysInMonth=30]
 * @returns {number} Vitality in [0.25, 1.0]
 */
export function computeSealedVitality({ activeDays = 0, totalDaysInMonth = 30 } = {}) {
  const days = Math.max(1, Number(totalDaysInMonth) || 30)
  const active = Math.max(0, Number(activeDays) || 0)
  const consistency = Math.min(1.0, active / days)
  return Math.max(0.25, Math.min(1.0, Number((0.2 + consistency * 0.8).toFixed(2))))
}

export function computeVitality({
  streak = 0,
  activeDaysThisMonth = 0,
  daysElapsedInMonth = 1,
  daysSinceLastSession = 0,
  isSealed = false,
} = {}) {
  const elapsed = Math.max(1, Number(daysElapsedInMonth) || 1)
  const active = Math.max(0, Number(activeDaysThisMonth) || 0)
  const consistency = Math.min(1.0, active / elapsed)

  if (isSealed) {
    // For sealed past months, vitality encodes the month's final overall consistency
    return computeSealedVitality({ activeDays: active, totalDaysInMonth: elapsed })
  }

  // Living month calculation:
  // Recency curve: recent focus keeps the ecosystem vivid
  const daysSince = Math.max(0, Number(daysSinceLastSession) || 0)
  let recencyFactor
  if (daysSince === 0) {
    recencyFactor = 1.0
  } else if (daysSince === 1) {
    recencyFactor = 0.92
  } else if (daysSince === 2) {
    recencyFactor = 0.72
  } else if (daysSince === 3) {
    recencyFactor = 0.52
  } else if (daysSince <= 6) {
    recencyFactor = 0.35
  } else {
    recencyFactor = 0.20
  }

  // Active streak reward: up to +0.15 boost
  const streakBoost = Math.min(0.15, Math.max(0, (streak || 0) * 0.03))

  // Completing a focus session today immediately rejuvenates the forest
  const recoveryBoost = daysSince === 0 ? 0.15 : 0

  const rawVitality = recencyFactor * 0.55 + consistency * 0.30 + streakBoost + recoveryBoost
  return Math.max(0.15, Math.min(1.0, Number(rawVitality.toFixed(2))))
}

/**
 * Returns a human-friendly label describing ecosystem vitality.
 * @param {number} vitality
 */
export function getVitalityStatus(vitality) {
  if (vitality >= 0.85) return { label: 'Thriving', color: '#10b981', mood: 'flourishing' }
  if (vitality >= 0.65) return { label: 'Vibrant', color: '#34d399', mood: 'healthy' }
  if (vitality >= 0.45) return { label: 'Temperate', color: '#fbbf24', mood: 'stable' }
  if (vitality >= 0.25) return { label: 'Dry Spell', color: '#f97316', mood: 'thirsty' }
  return { label: 'Parched', color: '#ef4444', mood: 'dormant' }
}

/**
 * Computes color grading adjustments for canvas rendering.
 * @param {number} vitality
 * @returns {{ satMultiplier: number, warmTint: number, waterAlpha: number }}
 */
export function getVitalityShading(vitality) {
  // Saturation: 0.55 at worst drought, 1.15 at peak bloom
  const satMultiplier = 0.55 + vitality * 0.60
  // Warm yellow/brown tint for dry grass: 0.35 when parched, 0.0 when lush
  const warmTint = Math.max(0, (0.6 - vitality) * 0.6)
  // Water volume / clarity factor
  const waterAlpha = Math.max(0.25, Math.min(1.0, 0.3 + vitality * 0.7))

  return { satMultiplier, warmTint, waterAlpha }
}
