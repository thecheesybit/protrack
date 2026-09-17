import { describe, it, expect } from 'vitest'
import { computePlantings, summarizePlantings, needsSimplify, planSessionSimplification } from '@/lib/plantGrowth'

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

describe('needsSimplify', () => {
  it('flags a legacy session recorded above one 25-minute tree block', () => {
    expect(needsSimplify({ durationMin: 60 })).toBe(true)
    expect(needsSimplify({ durationMin: 26 })).toBe(true)
  })

  it('leaves already-simplified sessions alone (idempotent)', () => {
    expect(needsSimplify({ durationMin: 25 })).toBe(false)
    expect(needsSimplify({ durationMin: 12 })).toBe(false)
    expect(needsSimplify({ durationMin: 0 })).toBe(false)
  })

  it('ignores failed / incomplete sessions', () => {
    expect(needsSimplify({ durationMin: 90, completed: false })).toBe(false)
    expect(needsSimplify({ durationMin: 90, failedReason: 'plant died' })).toBe(false)
    expect(needsSimplify(null)).toBe(false)
    expect(needsSimplify(undefined)).toBe(false)
  })
})

describe('planSessionSimplification', () => {
  it('converts a legacy 60-min session into 2 trees and 1 shrub, deleting the original', () => {
    const legacy = {
      id: 'sess-60',
      durationMin: 60,
      completed: true,
      modeId: 'mode-1',
      subjectId: 'sub-a',
      label: 'Deep Work',
      startedAt: '2026-09-01T10:00:00Z',
    }
    const result = planSessionSimplification([legacy])

    expect(result.convertedCount).toBe(1)
    expect(result.toDelete).toEqual(['sess-60'])
    expect(result.toCreate).toHaveLength(3)

    // Two 25m trees + one 10m shrub
    expect(result.toCreate[0].docData).toMatchObject({
      durationMin: 25,
      plantType: 'tree',
      modeId: 'mode-1',
      subjectId: 'sub-a',
      label: 'Deep Work',
    })
    expect(result.toCreate[1].docData).toMatchObject({
      durationMin: 25,
      plantType: 'tree',
    })
    expect(result.toCreate[2].docData).toMatchObject({
      durationMin: 10,
      plantType: 'shrub',
    })

    expect(result.newStats).toEqual({
      treesGrown: 2,
      shrubsGrown: 1,
      flowersGrown: 0,
    })
  })

  it('leaves already-simplified sessions untouched and preserves their flora counts', () => {
    const sessions = [
      { id: 's1', durationMin: 25, completed: true, plantType: 'tree' },
      { id: 's2', durationMin: 12, completed: true, plantType: 'shrub' },
      { id: 's3', durationMin: 5, completed: true, plantType: 'flower' },
    ]
    const result = planSessionSimplification(sessions)

    expect(result.convertedCount).toBe(0)
    expect(result.toDelete).toEqual([])
    expect(result.toCreate).toEqual([])
    expect(result.newStats).toEqual({
      treesGrown: 1,
      shrubsGrown: 1,
      flowersGrown: 1,
    })
  })

  it('is completely idempotent: re-simplifying post-migration data produces 0 changes', () => {
    const mixed = [
      { id: 's-legacy', durationMin: 50, completed: true, modeId: 'm1' },
      { id: 's-ok', durationMin: 25, completed: true, plantType: 'tree' },
    ]
    const firstPass = planSessionSimplification(mixed)
    expect(firstPass.convertedCount).toBe(1)
    expect(firstPass.toCreate).toHaveLength(2)

    // Build the post-migration set
    const postMigration = [
      mixed[1], // kept
      ...firstPass.toCreate.map((c, idx) => ({ id: `child-${idx}`, ...c.docData })),
    ]

    const secondPass = planSessionSimplification(postMigration)
    expect(secondPass.convertedCount).toBe(0)
    expect(secondPass.toDelete).toEqual([])
    expect(secondPass.toCreate).toEqual([])
    expect(secondPass.newStats).toEqual(firstPass.newStats)
  })

  it('ignores failed sessions and null inputs', () => {
    const failed = [
      { id: 'f1', durationMin: 60, completed: false },
      { id: 'f2', durationMin: 45, failedReason: 'quit' },
      null,
    ]
    const result = planSessionSimplification(failed)
    expect(result.convertedCount).toBe(0)
    expect(result.toCreate).toEqual([])
    expect(result.toDelete).toEqual([])
    expect(result.newStats).toEqual({ treesGrown: 0, shrubsGrown: 0, flowersGrown: 0 })
  })
})
