import { describe, it, expect } from 'vitest'
import {
  filterSuccessfulSessions,
  getTreeTooltip,
  getPlantType,
} from '../CalendarForest'

describe('CalendarForest - Session Filtering & Tree Count', () => {
  const targetDate = '2026-09-07'

  it('filters out failed, cancelled, and 0-minute sessions', () => {
    const mockSessions = [
      {
        id: 's1',
        completed: true,
        durationMin: 25,
        startedAt: new Date('2026-09-07T10:00:00Z'),
      },
      {
        id: 's2',
        completed: false, // failed
        durationMin: 0,
        failedReason: 'plant died/was not planted successfully',
        startedAt: new Date('2026-09-07T11:00:00Z'),
      },
      {
        id: 's3',
        completed: true,
        durationMin: 0, // 0 min invalid
        startedAt: new Date('2026-09-07T12:00:00Z'),
      },
      {
        id: 's4',
        completed: true,
        durationMin: 45,
        startedAt: new Date('2026-09-07T14:00:00Z'),
      },
      {
        id: 's5',
        completed: true,
        durationMin: 30,
        startedAt: new Date('2026-09-08T09:00:00Z'), // different date
      },
    ]

    const result = filterSuccessfulSessions(mockSessions, targetDate)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.id)).toEqual(['s1', 's4'])
  })

  it('sorts sessions chronologically so trees sprout in order of completion', () => {
    const mockSessions = [
      {
        id: 'evening',
        completed: true,
        durationMin: 30,
        startedAt: new Date('2026-09-07T18:00:00Z'),
      },
      {
        id: 'morning',
        completed: true,
        durationMin: 25,
        startedAt: new Date('2026-09-07T09:00:00Z'),
      },
      {
        id: 'afternoon',
        completed: true,
        durationMin: 50,
        startedAt: new Date('2026-09-07T14:00:00Z'),
      },
    ]

    const result = filterSuccessfulSessions(mockSessions, targetDate)
    expect(result.map((s) => s.id)).toEqual(['morning', 'afternoon', 'evening'])
  })

  it('handles Firestore Timestamps with toDate() method', () => {
    const firestoreTimestamp = {
      toDate: () => new Date('2026-09-07T11:30:00Z'),
    }
    const mockSessions = [
      {
        id: 'fs1',
        completed: true,
        durationMin: 50,
        startedAt: firestoreTimestamp,
      },
    ]

    const result = filterSuccessfulSessions(mockSessions, targetDate)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('fs1')
  })

  it('supports 4, 5, and more successful sessions on a single day without capping', () => {
    const sessions = [1, 2, 3, 4, 5, 6, 7].map((num) => ({
      id: `session-${num}`,
      completed: true,
      durationMin: 25 + num * 5,
      startedAt: new Date(`2026-09-07T${String(8 + num).padStart(2, '0')}:00:00Z`),
    }))

    const result = filterSuccessfulSessions(sessions, targetDate)
    expect(result).toHaveLength(7)
  })

  it('returns empty array when sessions is null or empty', () => {
    expect(filterSuccessfulSessions(null, targetDate)).toEqual([])
    expect(filterSuccessfulSessions([], targetDate)).toEqual([])
  })
})

describe('CalendarForest - Foliage Type Determination', () => {
  it('assigns flower for sessions strictly under 10 minutes', () => {
    expect(getPlantType({ durationMin: 5 })).toBe('flower')
    expect(getPlantType({ durationMin: 9 })).toBe('flower')
  })

  it('assigns shrub for sessions between 10 and 15 minutes', () => {
    expect(getPlantType({ durationMin: 10 })).toBe('shrub')
    expect(getPlantType({ durationMin: 12 })).toBe('shrub')
    expect(getPlantType({ durationMin: 15 })).toBe('shrub')
  })

  it('assigns tree for sessions over 15 minutes', () => {
    expect(getPlantType({ durationMin: 16 })).toBe('tree')
    expect(getPlantType({ durationMin: 25 })).toBe('tree')
    expect(getPlantType({ durationMin: 60 })).toBe('tree')
  })

  it('honors explicitly saved plantType', () => {
    expect(getPlantType({ durationMin: 30, plantType: 'flower' })).toBe('flower')
    expect(getPlantType({ durationMin: 5, plantType: 'shrub' })).toBe('shrub')
  })
})

describe('CalendarForest - Tooltip Formatting', () => {
  it('formats tooltip with duration, deep focus distinction, and foliage type', () => {
    const sessionTree = {
      id: 's1',
      durationMin: 50,
      label: 'Calculus Review',
      startedAt: new Date('2026-09-07T10:30:00'),
    }
    const tooltipTree = getTreeTooltip(sessionTree, 1, 4)
    expect(tooltipTree.title).toBe('50m Deep Focus')
    expect(tooltipTree.detail).toContain('Calculus Review')
    expect(tooltipTree.detail).toContain('Tree 2 of 4')

    const sessionFlower = {
      id: 's2',
      durationMin: 8,
      label: 'Quick Vocab',
      startedAt: new Date('2026-09-07T11:00:00'),
    }
    const tooltipFlower = getTreeTooltip(sessionFlower, 0, 2)
    expect(tooltipFlower.title).toBe('8m Focus')
    expect(tooltipFlower.detail).toContain('Quick Vocab')
    expect(tooltipFlower.detail).toContain('Flower 1 of 2')

    const sessionShrub = {
      id: 's3',
      durationMin: 12,
      label: 'Practice Problems',
      startedAt: new Date('2026-09-07T12:00:00'),
    }
    const tooltipShrub = getTreeTooltip(sessionShrub, 0, 1)
    expect(tooltipShrub.title).toBe('12m Focus')
    expect(tooltipShrub.detail).toContain('Shrub 1 of 1')
  })
})

describe('CalendarForest - Raster Forest Sprites', () => {
  it('exports TREE_SPRITES with 17 valid tree sprites', async () => {
    const { TREE_SPRITES } = await import('../ForestSprites')
    expect(TREE_SPRITES).toHaveLength(17)
    TREE_SPRITES.forEach((tree) => {
      expect(tree.id).toBeDefined()
      expect(tree.src).toBeDefined()
      expect(tree.aspect).toBeGreaterThan(0)
    })
  })

  it('exports SHRUB_SPRITES with 15 valid shrub sprites', async () => {
    const { SHRUB_SPRITES } = await import('../ForestSprites')
    expect(SHRUB_SPRITES).toHaveLength(15)
    SHRUB_SPRITES.forEach((shrub) => {
      expect(shrub.id).toBeDefined()
      expect(shrub.src).toBeDefined()
      expect(shrub.aspect).toBeGreaterThan(0)
    })
  })

  it('exports FLOWER_SPRITES with 15 valid flower sprites', async () => {
    const { FLOWER_SPRITES } = await import('../ForestSprites')
    expect(FLOWER_SPRITES).toHaveLength(15)
    FLOWER_SPRITES.forEach((flower) => {
      expect(flower.id).toBeDefined()
      expect(flower.src).toBeDefined()
      expect(flower.aspect).toBeGreaterThan(0)
    })
  })

  it('resolves species and variants deterministically for all foliage types', async () => {
    const { resolveTreeSprite, resolveFoliageSprite } = await import('../ForestSprites')
    const oak0 = resolveTreeSprite('oak', 0)
    const oak1 = resolveTreeSprite('oak', 1)
    const pine0 = resolveTreeSprite('pine', 0)
    const blossom0 = resolveTreeSprite('blossom', 0)

    expect(oak0.id).toBeDefined()
    expect(oak1.id).toBeDefined()
    expect(oak0.id).not.toEqual(oak1.id)
    expect(pine0.id).toBeDefined()
    expect(blossom0.id).toBeDefined()

    const flower0 = resolveFoliageSprite('flower', 'oak', 0)
    const flower1 = resolveFoliageSprite('flower', 'oak', 1)
    expect(flower0.id).toBeDefined()
    expect(flower1.id).toBeDefined()
    expect(flower0.id).not.toEqual(flower1.id)

    const shrub0 = resolveFoliageSprite('shrub', 'oak', 0)
    expect(shrub0.id).toBeDefined()
  })

  it('re-exports SpriteTree and SpriteFoliage from CalendarForest', async () => {
    const { SpriteTree, SpriteFoliage } = await import('../CalendarForest')
    expect(SpriteTree).toBeDefined()
    expect(SpriteFoliage).toBeDefined()
  })

  it('formats flora breakdown organically into natural language', async () => {
    const { formatFloraBreakdown } = await import('../ForestSprites')
    expect(formatFloraBreakdown([])).toBe('0 trees')

    // 4 trees and 1 flower (user's exact scenario)
    const sessions = [
      { id: '1', durationMin: 25, completed: true },
      { id: '2', durationMin: 30, completed: true },
      { id: '3', durationMin: 45, completed: true },
      { id: '4', durationMin: 20, completed: true },
      { id: '5', durationMin: 8, completed: true }, // flower
    ]
    expect(formatFloraBreakdown(sessions)).toBe('4 trees and a flower')

    // 2 trees, 1 shrub, 1 flower
    const mixed = [
      { id: '1', durationMin: 25, completed: true },
      { id: '2', durationMin: 25, completed: true },
      { id: '3', durationMin: 12, completed: true }, // shrub
      { id: '4', durationMin: 5, completed: true },  // flower
    ]
    expect(formatFloraBreakdown(mixed)).toBe('2 trees, 1 shrub and a flower')

    // 5 trees only
    const onlyTrees = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, durationMin: 25, completed: true }))
    expect(formatFloraBreakdown(onlyTrees)).toBe('5 trees')
  })

  it('generates deterministic foliage seeds for sessions across all views', async () => {
    const { getSessionFoliageSeed } = await import('../ForestSprites')
    const s1 = { id: 'session-xyz-123', startedAt: 1725838000000 }
    const seedA = getSessionFoliageSeed(s1)
    const seedB = getSessionFoliageSeed(s1)
    expect(seedA).toBe(seedB)
    expect(typeof seedA).toBe('number')
    expect(seedA).toBeGreaterThan(0)
  })
})
