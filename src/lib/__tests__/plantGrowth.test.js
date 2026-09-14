import { describe, it, expect } from 'vitest'
import { computePlantings, summarizePlantings } from '@/lib/plantGrowth'

describe('computePlantings', () => {
  it('plants a flower under 10 minutes (unchanged short-session scale)', () => {
    expect(computePlantings(5)).toEqual([{ type: 'flower', durationMin: 5 }])
  })

  it('plants a shrub between 10 and 15 minutes inclusive', () => {
    expect(computePlantings(10)).toEqual([{ type: 'shrub', durationMin: 10 }])
    expect(computePlantings(15)).toEqual([{ type: 'shrub', durationMin: 15 }])
  })

  it('plants a tree above 15 minutes and below the 25-minute threshold', () => {
    expect(computePlantings(20)).toEqual([{ type: 'tree', durationMin: 20 }])
    expect(computePlantings(24)).toEqual([{ type: 'tree', durationMin: 24 }])
  })

  it('plants exactly one tree at exactly 25 minutes with no remainder', () => {
    expect(computePlantings(25)).toEqual([{ type: 'tree', durationMin: 25 }])
  })

  it('plants one tree per full 25-minute block, remainder capped at flower/shrub', () => {
    // 45 = 1 tree + 20 remainder -> shrub, never a second tree
    expect(computePlantings(45)).toEqual([
      { type: 'tree', durationMin: 25 },
      { type: 'shrub', durationMin: 20 },
    ])
    // 30 = 1 tree + 5 remainder -> flower
    expect(computePlantings(30)).toEqual([
      { type: 'tree', durationMin: 25 },
      { type: 'flower', durationMin: 5 },
    ])
  })

  it('plants multiple trees for a long (e.g. 3 hour) session with a capped remainder', () => {
    // 180 = 7 trees (175) + 5 remainder -> flower
    const result = computePlantings(180)
    expect(result.filter((p) => p.type === 'tree')).toHaveLength(7)
    expect(result.at(-1)).toEqual({ type: 'flower', durationMin: 5 })
  })

  it('plants only trees when duration is an exact multiple of 25', () => {
    expect(computePlantings(75)).toEqual([
      { type: 'tree', durationMin: 25 },
      { type: 'tree', durationMin: 25 },
      { type: 'tree', durationMin: 25 },
    ])
  })

  it('never returns zero plantings, even for a near-zero duration', () => {
    expect(computePlantings(0)).toEqual([{ type: 'flower', durationMin: 1 }])
  })
})

describe('summarizePlantings', () => {
  it('tallies plantings into counts', () => {
    const plantings = [
      { type: 'tree', durationMin: 25 },
      { type: 'tree', durationMin: 25 },
      { type: 'shrub', durationMin: 12 },
    ]
    expect(summarizePlantings(plantings)).toEqual({ trees: 2, shrubs: 1, flowers: 0 })
  })

  it('returns all-zero counts for an empty or missing input', () => {
    expect(summarizePlantings([])).toEqual({ trees: 0, shrubs: 0, flowers: 0 })
    expect(summarizePlantings(undefined)).toEqual({ trees: 0, shrubs: 0, flowers: 0 })
  })
})
