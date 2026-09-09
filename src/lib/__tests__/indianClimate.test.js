import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  INDIAN_SEASONS,
  getIndianSeasonForMonth,
  getActiveIndianSeason,
  readSeasonOverride,
  setSeasonOverride,
  readWeatherOverride,
  setWeatherOverride,
  isWeatherEffectsEnabled,
  setWeatherEffectsEnabled,
  computeWeatherState,
  SEASON_OVERRIDE_KEY,
  WEATHER_OVERRIDE_KEY,
  WEATHER_ENABLED_KEY,
} from '../indianClimate'

describe('Indian Climate & Seasonal Ritu Engine', () => {
  let store = {}
  let originalLocalStorage

  beforeEach(() => {
    store = {}
    originalLocalStorage = global.localStorage
    global.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] },
      clear: () => { store = {} },
    }
  })

  afterEach(() => {
    global.localStorage = originalLocalStorage
  })

  it('correctly maps each calendar month to its authentic Indian season', () => {
    // 0 = Jan, 1 = Feb, 2 = Mar, 3 = Apr, 4 = May, 5 = Jun
    // 6 = Jul, 7 = Aug, 8 = Sep, 9 = Oct, 10 = Nov, 11 = Dec

    expect(getIndianSeasonForMonth(11).id).toBe('shishir') // Dec -> Shishir (Winter)
    expect(getIndianSeasonForMonth(0).id).toBe('shishir')  // Jan -> Shishir (Winter)

    expect(getIndianSeasonForMonth(1).id).toBe('vasant')  // Feb -> Vasant (Spring)
    expect(getIndianSeasonForMonth(2).id).toBe('vasant')  // Mar -> Vasant (Spring)

    expect(getIndianSeasonForMonth(3).id).toBe('grishma') // Apr -> Grishma (Summer)
    expect(getIndianSeasonForMonth(4).id).toBe('grishma') // May -> Grishma (Summer)

    expect(getIndianSeasonForMonth(5).id).toBe('varsha')  // Jun -> Varsha (Monsoon)
    expect(getIndianSeasonForMonth(6).id).toBe('varsha')  // Jul -> Varsha (Monsoon)
    expect(getIndianSeasonForMonth(7).id).toBe('varsha')  // Aug -> Varsha (Monsoon)

    expect(getIndianSeasonForMonth(8).id).toBe('sharad')  // Sep -> Sharad (Autumn)
    expect(getIndianSeasonForMonth(9).id).toBe('sharad')  // Oct -> Sharad (Autumn)

    expect(getIndianSeasonForMonth(10).id).toBe('hemant') // Nov -> Hemant (Pre-Winter)
  })

  it('guarantees that Summer midday (Grishma at 12:00-14:00) is NEVER rainy', () => {
    // Check multiple days across April & May at midday (13:00)
    for (let day = 1; day <= 30; day++) {
      const summerMidday = new Date(2026, 4, day, 13, 0, 0) // May
      const weather = computeWeatherState('grishma', summerMidday)
      expect(weather.isRaining).toBe(false)
      expect(weather.condition).not.toBe('rain')
    }
  })

  it('guarantees that Winter midday (Shishir at 12:00-14:00) is NEVER rainy', () => {
    for (let day = 1; day <= 30; day++) {
      const winterMidday = new Date(2026, 0, day, 12, 30, 0) // Jan
      const weather = computeWeatherState('shishir', winterMidday)
      expect(weather.isRaining).toBe(false)
      expect(weather.condition).not.toBe('rain')
    }
  })

  it('allows occasional rain in Monsoon (Varsha) season with realistic frequency', () => {
    let rainCount = 0
    const totalSamples = 100

    for (let i = 0; i < totalSamples; i++) {
      // Sample different hours and minutes in July (month 6)
      const monsoonDate = new Date(2026, 6, 1 + (i % 25), (i % 24), (i * 7) % 60)
      const weather = computeWeatherState('varsha', monsoonDate)
      if (weather.isRaining) rainCount++
    }

    // Occasional rain: should be between 20% and 75% across the monsoon samples
    expect(rainCount).toBeGreaterThan(15)
    expect(rainCount).toBeLessThan(85)
  })

  it('generates high wind gusts (Loo) during Summer (Grishma)', () => {
    const summerSeason = INDIAN_SEASONS.find((s) => s.id === 'grishma')
    expect(summerSeason.windProfile.type).toBe('gusty_loo')
    expect(summerSeason.windProfile.gustSpeed).toBeGreaterThanOrEqual(40)
  })

  it('supports season manual override and persistence in localStorage', () => {
    expect(readSeasonOverride()).toBe(null)

    setSeasonOverride('varsha')
    expect(localStorage.getItem(SEASON_OVERRIDE_KEY)).toBe('varsha')
    expect(readSeasonOverride()).toBe('varsha')
    expect(getActiveIndianSeason().id).toBe('varsha')

    setSeasonOverride('shishir')
    expect(readSeasonOverride()).toBe('shishir')
    expect(getActiveIndianSeason().id).toBe('shishir')

    setSeasonOverride('auto')
    expect(readSeasonOverride()).toBe(null)
  })

  it('supports weather condition override for on-demand simulation testing', () => {
    expect(readWeatherOverride()).toBe(null)

    setWeatherOverride('rain')
    expect(readWeatherOverride()).toBe('rain')
    const weather = computeWeatherState('grishma', new Date(2026, 4, 15, 12, 0))
    expect(weather.isRaining).toBe(true)
    expect(weather.condition).toBe('rain')

    setWeatherOverride('breezy')
    expect(readWeatherOverride()).toBe('breezy')
    const breezyWeather = computeWeatherState('shishir', new Date(2026, 0, 15, 8, 0))
    expect(breezyWeather.hasWindGusts).toBe(true)
    expect(breezyWeather.condition).toBe('breezy')

    setWeatherOverride('auto')
    expect(readWeatherOverride()).toBe(null)
  })

  it('persists weather effects enabled toggle', () => {
    expect(isWeatherEffectsEnabled()).toBe(true)

    setWeatherEffectsEnabled(false)
    expect(localStorage.getItem(WEATHER_ENABLED_KEY)).toBe('false')
    expect(isWeatherEffectsEnabled()).toBe(false)

    setWeatherEffectsEnabled(true)
    expect(localStorage.getItem(WEATHER_ENABLED_KEY)).toBe('true')
    expect(isWeatherEffectsEnabled()).toBe(true)
  })
})
