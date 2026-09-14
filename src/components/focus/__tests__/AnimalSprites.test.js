import { describe, it, expect } from 'vitest'
import {
  resolveAnimalsForCount,
  unlockedAnimalTiers,
  ANIMAL_SPRITES,
  ANIMAL_TIER_THRESHOLDS,
} from '../AnimalSprites'

describe('unlockedAnimalTiers', () => {
  it('unlocks no tiers below the small threshold', () => {
    expect(unlockedAnimalTiers(0)).toEqual([])
    expect(unlockedAnimalTiers(ANIMAL_TIER_THRESHOLDS.small - 1)).toEqual([])
  })

  it('unlocks tiers cumulatively as count grows', () => {
    expect(unlockedAnimalTiers(ANIMAL_TIER_THRESHOLDS.small)).toEqual(['small'])
    expect(unlockedAnimalTiers(ANIMAL_TIER_THRESHOLDS.medium)).toEqual(['small', 'medium'])
    expect(unlockedAnimalTiers(ANIMAL_TIER_THRESHOLDS.large)).toEqual(['small', 'medium', 'large'])
  })
})

describe('resolveAnimalsForCount', () => {
  it('returns nothing below the small threshold', () => {
    expect(resolveAnimalsForCount(0, 1)).toEqual([])
    expect(resolveAnimalsForCount(4, 1)).toEqual([])
  })

  it('returns exactly one animal from the small pool once unlocked', () => {
    const result = resolveAnimalsForCount(5, 42)
    expect(result).toHaveLength(1)
    expect(ANIMAL_SPRITES.find((a) => a.id === result[0].id)?.tier).toBe('small')
  })

  it('returns up to two animals once the medium tier unlocks', () => {
    const result = resolveAnimalsForCount(15, 42)
    expect(result.length).toBeLessThanOrEqual(2)
    expect(result.length).toBeGreaterThan(0)
    for (const a of result) {
      expect(['small', 'medium']).toContain(ANIMAL_SPRITES.find((s) => s.id === a.id)?.tier)
    }
  })

  it('returns up to three animals, from all tiers combined, once large unlocks', () => {
    const result = resolveAnimalsForCount(30, 42)
    expect(result.length).toBeLessThanOrEqual(3)
    expect(result.length).toBeGreaterThan(0)
  })

  it('is deterministic for a given count + seed', () => {
    const a = resolveAnimalsForCount(30, 7)
    const b = resolveAnimalsForCount(30, 7)
    expect(a).toEqual(b)
  })

  it('varies with a different seed', () => {
    const a = resolveAnimalsForCount(30, 1)
    const b = resolveAnimalsForCount(30, 2)
    // Not a hard guarantee of inequality for every seed pair, but with 40
    // sprites and a real PRNG this pair should differ in ids or position.
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b))
  })

  it('never returns duplicate animals in one result', () => {
    const result = resolveAnimalsForCount(30, 99)
    const ids = result.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('positions are within the expected scatter bounds', () => {
    const result = resolveAnimalsForCount(30, 3)
    for (const a of result) {
      expect(a.leftPct).toBeGreaterThanOrEqual(8)
      expect(a.leftPct).toBeLessThanOrEqual(92)
      expect(a.bottomPct).toBeGreaterThan(0)
    }
  })
})
