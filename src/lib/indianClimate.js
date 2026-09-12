/**
 * Indian Climate & Seasonal Ritu Engine
 *
 * Implements the traditional Indian 6-season cycle (Shad Ritu) combined with
 * realistic meteorological conditions of the Indian subcontinent:
 *
 * 1. Shishir (Winter)       — Dec to Jan (Months 11, 0)
 *    Crisp cold mornings, dense morning fog (Kohra), gentle northern breeze, clear starry nights.
 * 2. Vasant (Spring)        — Feb to Mar (Months 1, 2)
 *    Pleasant golden sunlight, blooming floral pollen/petals, gentle playful breeze, clear turquoise skies.
 * 3. Grishma (Summer)       — Apr to May (Months 3, 4)
 *    Blazing radiant sun, heat haze / mirage shimmer, hot gusty winds (Loo) carrying dust & dry leaves. Zero rain at midday!
 * 4. Varsha (Monsoon)       — Jun to Aug (Months 5, 6, 7)
 *    Overcast slate skies, petrichor atmosphere, frequent passing rain showers, gusty squalls, distant lightning flashes.
 * 5. Sharad (Autumn)        — Sep to Oct (Months 8, 9)
 *    Retreating monsoon, washed azure blue skies, white cumulus cotton clouds (Kaash), golden afternoons, rare drizzle.
 * 6. Hemant (Pre-Winter)    — November (Month 10)
 *    Cooling twilight, mellow sunshine, evening twilight fog, calm crisp air.
 */

export const INDIAN_SEASONS = [
  {
    id: 'shishir',
    name: 'Winter',
    sanskritName: 'Shishir',
    hindiName: 'शिशिर (सर्दी)',
    monthsText: 'Dec – Jan',
    months: [11, 0],
    desc: 'Crisp cold, dense morning fog (Kohra), gentle northern breeze & bright stars',
    sunIntensity: 'pale',
    windProfile: { baseSpeed: 8, gustSpeed: 16, direction: 'NNE', type: 'calm' },
    rainProb: 0.04, // Extremely rare winter shower (Western Disturbance)
    fogProb: 0.75,  // Frequent dawn & morning fog
    hazeProb: 0.0,
    accentColor: '#38bdf8',
  },
  {
    id: 'vasant',
    name: 'Spring',
    sanskritName: 'Vasant',
    hindiName: 'वसन्त (बहार)',
    monthsText: 'Feb – Mar',
    months: [1, 2],
    desc: 'Pleasant golden sun, floating floral petals, gentle balmy breeze & clear skies',
    sunIntensity: 'golden',
    windProfile: { baseSpeed: 14, gustSpeed: 24, direction: 'SW', type: 'breeze' },
    rainProb: 0.08,
    fogProb: 0.15,
    hazeProb: 0.05,
    accentColor: '#fbbf24',
  },
  {
    id: 'grishma',
    name: 'Summer',
    sanskritName: 'Grishma',
    hindiName: 'ग्रीष्म (गर्मी)',
    monthsText: 'Apr – May',
    months: [3, 4],
    desc: 'Blazing radiant sun, shimmering heat haze & hot gusty winds (Loo) with dust motes. No midday rain!',
    sunIntensity: 'blazing',
    windProfile: { baseSpeed: 22, gustSpeed: 42, direction: 'WNW', type: 'gusty_loo' },
    rainProb: 0.02, // Essentially zero rain, especially at midday
    fogProb: 0.0,
    hazeProb: 0.85, // High afternoon heat haze
    accentColor: '#f97316',
  },
  {
    id: 'varsha',
    name: 'Monsoon',
    sanskritName: 'Varsha',
    hindiName: 'वर्षा (मानसून)',
    monthsText: 'Jun – Aug',
    months: [5, 6, 7],
    desc: 'Overcast slate skies, petrichor atmosphere, gusty squalls & occasional passing rain showers',
    sunIntensity: 'diffused',
    windProfile: { baseSpeed: 26, gustSpeed: 48, direction: 'SW', type: 'squall' },
    rainProb: 0.45, // Occasional periodic rain
    fogProb: 0.1,
    hazeProb: 0.0,
    accentColor: '#0ea5e9',
  },
  {
    id: 'sharad',
    name: 'Autumn',
    sanskritName: 'Sharad',
    hindiName: 'शरद (पतझड़)',
    monthsText: 'Sep – Oct',
    months: [8, 9],
    desc: 'Deep azure blue skies, drifting white cotton clouds (Kaash), mild golden sun & falling leaves',
    sunIntensity: 'warm',
    windProfile: { baseSpeed: 12, gustSpeed: 22, direction: 'NE', type: 'breeze' },
    rainProb: 0.12, // Occasional light retreating shower
    fogProb: 0.1,
    hazeProb: 0.1,
    accentColor: '#f59e0b',
  },
  {
    id: 'hemant',
    name: 'Pre-Winter',
    sanskritName: 'Hemant',
    hindiName: 'हेमन्त (गुलाबी ठंड)',
    monthsText: 'November',
    months: [10],
    desc: 'Pink winter chill, mellow sunshine, evening twilight mist & calm refreshing air',
    sunIntensity: 'mellow',
    windProfile: { baseSpeed: 10, gustSpeed: 18, direction: 'N', type: 'gentle' },
    rainProb: 0.03,
    fogProb: 0.45,
    hazeProb: 0.0,
    accentColor: '#6366f1',
  },
]

export const CLIMATE_OVERRIDE_EVENT = 'protrack:climate-override'
export const SEASON_OVERRIDE_KEY = 'protrack:climate:season_override'
export const WEATHER_OVERRIDE_KEY = 'protrack:climate:weather_override'
export const WEATHER_ENABLED_KEY = 'protrack:climate:effects_enabled'

/**
 * Returns the Indian season corresponding to a given calendar month (0 = Jan, 11 = Dec).
 * @param {number} month
 * @returns {typeof INDIAN_SEASONS[0]}
 */
export function getIndianSeasonForMonth(month = new Date().getMonth()) {
  const normalizedMonth = ((month % 12) + 12) % 12
  const match = INDIAN_SEASONS.find((s) => s.months.includes(normalizedMonth))
  return match || INDIAN_SEASONS[0]
}

/**
 * Retrieves the currently active season, taking into account any manual user override.
 * @returns {typeof INDIAN_SEASONS[0]}
 */
export function getActiveIndianSeason() {
  const override = readSeasonOverride()
  if (override) {
    const matched = INDIAN_SEASONS.find((s) => s.id === override)
    if (matched) return matched
  }
  return getIndianSeasonForMonth(new Date().getMonth())
}
export const getCurrentSeason = getActiveIndianSeason

export function readSeasonOverride() {
  try {
    if (typeof localStorage === 'undefined') return null
    const val = localStorage.getItem(SEASON_OVERRIDE_KEY)
    if (val && INDIAN_SEASONS.some((s) => s.id === val)) return val
    return null
  } catch {
    return null
  }
}
export const getSeasonOverride = readSeasonOverride

export function setSeasonOverride(seasonId) {
  try {
    if (typeof localStorage === 'undefined') return
    if (!seasonId || seasonId === 'auto') {
      localStorage.removeItem(SEASON_OVERRIDE_KEY)
    } else {
      localStorage.setItem(SEASON_OVERRIDE_KEY, seasonId)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CLIMATE_OVERRIDE_EVENT))
    }
  } catch {
    // localStorage unavailable (private mode, quota) — override just won't persist
  }
}

export function readWeatherOverride() {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(WEATHER_OVERRIDE_KEY) || null
  } catch {
    return null
  }
}
export const getWeatherOverride = readWeatherOverride

export function setWeatherOverride(condition) {
  try {
    if (typeof localStorage === 'undefined') return
    if (!condition || condition === 'auto') {
      localStorage.removeItem(WEATHER_OVERRIDE_KEY)
    } else {
      localStorage.setItem(WEATHER_OVERRIDE_KEY, condition)
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CLIMATE_OVERRIDE_EVENT))
    }
  } catch {
    // localStorage unavailable (private mode, quota) — override just won't persist
  }
}

export function isWeatherEffectsEnabled() {
  try {
    if (typeof localStorage === 'undefined') return true
    const val = localStorage.getItem(WEATHER_ENABLED_KEY)
    return val !== 'false'
  } catch {
    return true
  }
}

export function setWeatherEffectsEnabled(enabled) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(WEATHER_ENABLED_KEY, enabled ? 'true' : 'false')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CLIMATE_OVERRIDE_EVENT))
    }
  } catch {
    // localStorage unavailable (private mode, quota) — override just won't persist
  }
}

/**
 * Deterministic pseudo-random float generator based on a seed number.
 */
function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/**
 * Computes procedural weather state based on the season, hour of the day,
 * and current date seed. Weather smoothly changes in ~25 minute blocks.
 *
 * Guarantees:
 *  - Midday in Summer (Grishma) and Winter (Shishir) is NEVER rainy.
 *  - Rain in Monsoon occurs periodically and occasionally (not permanently).
 *  - Summer afternoons have high heat haze & gusty winds.
 *  - Winter mornings have dense fog / mist.
 *
 * @param {string} seasonId
 * @param {Date} [now]
 * @returns {{
 *   condition: 'clear'|'breezy'|'heat_haze'|'overcast'|'rain'|'mist',
 *   intensity: 'light'|'moderate'|'heavy',
 *   isRaining: boolean,
 *   hasFog: boolean,
 *   hasHeatHaze: boolean,
 *   hasWindGusts: boolean,
 *   windSpeed: number,
 *   windAngle: number,
 * }}
 */
export function computeWeatherState(seasonId = 'shishir', now = new Date()) {
  // Check manual override first
  const manualOverride = readWeatherOverride()
  if (manualOverride && manualOverride !== 'auto') {
    return {
      condition: manualOverride,
      intensity: manualOverride === 'rain' ? 'moderate' : 'light',
      isRaining: manualOverride === 'rain',
      hasFog: manualOverride === 'mist',
      hasHeatHaze: manualOverride === 'heat_haze',
      hasWindGusts: manualOverride === 'breezy',
      windSpeed: manualOverride === 'breezy' ? 32 : 14,
      windAngle: 18,
    }
  }

  const season = INDIAN_SEASONS.find((s) => s.id === seasonId) || INDIAN_SEASONS[0]
  const hour = now.getHours()
  const minute = now.getMinutes()

  // 25-minute weather block cycle (smooth procedural transitions)
  const timeBlock = Math.floor((hour * 60 + minute) / 25)
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24))
  const seed = dayOfYear * 100 + timeBlock

  const roll1 = pseudoRandom(seed)
  const roll2 = pseudoRandom(seed + 1337)
  const roll3 = pseudoRandom(seed + 9999)

  let condition
  let intensity = 'light'
  let isRaining = false
  let hasFog = false
  let hasHeatHaze = false
  let hasWindGusts = false

  const isMidday = hour >= 11 && hour <= 15
  const isMorning = hour >= 5 && hour <= 9
  const isAfternoon = hour >= 14 && hour <= 18

  // 1. Check Fog / Mist (primarily winter mornings)
  if (isMorning && roll1 < season.fogProb) {
    condition = 'mist'
    hasFog = true
    intensity = roll2 < 0.5 ? 'moderate' : 'heavy'
  }
  // 2. Check Summer Heat Haze (midday/afternoon in Grishma)
  else if (season.id === 'grishma' && (isMidday || isAfternoon) && roll1 < season.hazeProb) {
    condition = 'heat_haze'
    hasHeatHaze = true
    hasWindGusts = roll2 < 0.7 // Summer hot gusts (Loo)
  }
  // 3. Check Occasional Rain
  // CRITICAL RULE: Midday in Summer, Winter, and Spring is NEVER rainy!
  else if (!(isMidday && (season.id === 'grishma' || season.id === 'shishir' || season.id === 'vasant')) && roll1 < season.rainProb) {
    condition = 'rain'
    isRaining = true
    intensity = season.id === 'varsha' && roll2 > 0.4 ? 'moderate' : 'light'
    hasWindGusts = season.id === 'varsha'
  }
  // 4. Check Wind Gusts / Breezy
  else if (roll2 < 0.4 || (season.id === 'grishma' && isAfternoon)) {
    condition = 'breezy'
    hasWindGusts = true
  }
  // 5. Check Overcast (especially monsoon)
  else if (season.id === 'varsha' && roll3 < 0.6) {
    condition = 'overcast'
  } else {
    condition = 'clear'
  }

  const baseSpeed = season.windProfile.baseSpeed
  const gustSpeed = season.windProfile.gustSpeed
  const windSpeed = hasWindGusts ? gustSpeed : baseSpeed + Math.round(roll3 * 8)
  const windAngle = 12 + Math.round(roll2 * 12) // 12° to 24° wind deflection

  return {
    condition,
    intensity,
    isRaining,
    hasFog,
    hasHeatHaze,
    hasWindGusts,
    windSpeed,
    windAngle,
  }
}
