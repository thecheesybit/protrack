import { describe, it, expect } from 'vitest'
import {
  SUCCESSION_TIERS,
  evaluateSuccessionTier,
  deriveMonthEcosystem,
  hashSeed,
} from '@/lib/ecosystem'

describe('ecosystem succession & merit progression', () => {
  it('starts at Tier 0 (Bare Substrate) on Day 1 or minimal volume', () => {
    const tier = evaluateSuccessionTier({ totalMin: 30, activeDays: 1, daysElapsed: 1 })
    expect(tier.tier).toBe(0)
    expect(tier.name).toBe('Bare Substrate')
    expect(tier.waterType).toBe('none')
  })

  it('unlocks Tier 1 (Pioneer Meadow) with >= 2h and >= 2 active days', () => {
    const tier = evaluateSuccessionTier({ totalMin: 140, activeDays: 2, daysElapsed: 5 })
    expect(tier.tier).toBe(1)
    expect(tier.name).toBe('Pioneer Meadow')
    expect(tier.waterType).toBe('puddle')
    expect(tier.fauna).toContain('butterfly')
  })

  it('unlocks Tier 2 (Shrubland) with pond and hills at >= 6h & consistency >= 0.4', () => {
    const tier = evaluateSuccessionTier({ totalMin: 400, activeDays: 5, daysElapsed: 10 })
    expect(tier.tier).toBe(2)
    expect(tier.waterType).toBe('pond')
    expect(tier.elevation).toBe('hillock')
  })

  it('unlocks Tier 3 (Young Forest) with stream at >= 15h & consistency >= 0.55', () => {
    const tier = evaluateSuccessionTier({ totalMin: 1000, activeDays: 9, daysElapsed: 15 })
    expect(tier.tier).toBe(3)
    expect(tier.waterType).toBe('stream')
    expect(tier.elevation).toBe('rolling_hills')
    expect(tier.fauna).toContain('deer')
  })

  it('unlocks Tier 4 (Mature Forest) with river and mountains at >= 30h & consistency >= 0.7', () => {
    const tier = evaluateSuccessionTier({ totalMin: 2000, activeDays: 16, daysElapsed: 22 })
    expect(tier.tier).toBe(4)
    expect(tier.waterType).toBe('river')
    expect(tier.elevation).toBe('rocky_peaks')
    expect(tier.fauna).toContain('fox')
  })

  it('unlocks Tier 5 (Climax Ecosystem) with waterfall & lake at >= 50h, consistency >= 0.85 & streak >= 4', () => {
    const tier = evaluateSuccessionTier({ totalMin: 3200, activeDays: 26, daysElapsed: 30, currentStreak: 5 })
    expect(tier.tier).toBe(5)
    expect(tier.waterType).toBe('waterfall')
    expect(tier.elevation).toBe('cliffs_waterfall')
    expect(tier.fauna).toContain('apex_predator')
  })

  it('is deterministic for the same user and month seed', () => {
    const eco1 = deriveMonthEcosystem({ totalMin: 800, activeDays: 8, daysElapsed: 12, uid: 'user-abc', year: 2026, month: 8 })
    const eco2 = deriveMonthEcosystem({ totalMin: 800, activeDays: 8, daysElapsed: 12, uid: 'user-abc', year: 2026, month: 8 })

    expect(eco1.seedNum).toBe(eco2.seedNum)
    expect(eco1.hydrology.riverEntryEdge).toBe(eco2.hydrology.riverEntryEdge)
    expect(eco1.hydrology.riverExitEdge).toBe(eco2.hydrology.riverExitEdge)
    expect(eco1.geomorphology.elevationCenter).toEqual(eco2.geomorphology.elevationCenter)
  })

  it('integrates season data from indianClimate', () => {
    // September = month 8 = Sharad (Autumn)
    const ecoSep = deriveMonthEcosystem({ month: 8, year: 2026 })
    expect(ecoSep.season.id).toBe('sharad')

    // June = month 5 = Varsha (Monsoon)
    const ecoJun = deriveMonthEcosystem({ month: 5, year: 2026 })
    expect(ecoJun.season.id).toBe('varsha')
    expect(ecoJun.weather.isMonsoon).toBe(true)
  })
})
