import { describe, it, expect } from 'vitest'
import {
  getSpiralHexCoord,
  hexToPixel,
  groupSessionsByMonth,
  deriveWorldHexes,
} from '@/lib/forestWorld'

describe('forestWorld Honeycomb Continent', () => {
  it('generates an outward spiral where index 0 is center and ring 1 wraps tightly', () => {
    expect(getSpiralHexCoord(0)).toEqual({ q: 0, r: 0 })

    const r1 = []
    for (let i = 1; i <= 6; i++) {
      r1.push(getSpiralHexCoord(i))
    }

    // All 6 hexes in ring 1 should have distance 1 from origin
    expect(r1).toHaveLength(6)
    for (const c of r1) {
      const dist = (Math.abs(c.q) + Math.abs(c.q + c.r) + Math.abs(c.r)) / 2
      expect(dist).toBe(1)
    }
  })

  it('converts axial hex coords to 2D isometric pixel offsets', () => {
    const p0 = hexToPixel(0, 0, 100)
    expect(p0.px).toBe(0)
    expect(p0.py).toBe(0)

    const p1 = hexToPixel(1, 0, 100)
    expect(p1.px).toBeCloseTo(173.2, 1)
  })

  it('groups focus sessions correctly by month', () => {
    const sessions = [
      { id: '1', completed: true, durationMin: 25, startedAt: new Date(2026, 7, 10) }, // Aug 2026
      { id: '2', completed: true, durationMin: 50, startedAt: new Date(2026, 7, 12) }, // Aug 2026
      { id: '3', completed: true, durationMin: 30, startedAt: new Date(2026, 8, 15) }, // Sep 2026
      { id: '4', completed: false, durationMin: 25, startedAt: new Date(2026, 8, 16) }, // incomplete: skipped
    ]

    const map = groupSessionsByMonth(sessions)
    expect(map.has('2026-08')).toBe(true)
    expect(map.has('2026-09')).toBe(true)
    expect(map.get('2026-08').totalMin).toBe(75)
    expect(map.get('2026-09').totalMin).toBe(30)
  })

  it('derives a complete world continent with past months sealed and current month living', () => {
    const now = new Date(2026, 8, 17) // Sep 17, 2026
    const sessions = [
      { id: '1', completed: true, durationMin: 600, startedAt: new Date(2026, 7, 10) }, // Aug (past)
      { id: '2', completed: true, durationMin: 300, startedAt: new Date(2026, 8, 5) },  // Sep (current)
    ]

    const hexes = deriveWorldHexes(sessions, { uid: 'u1', now, currentStreak: 3 })
    expect(hexes.length).toBeGreaterThanOrEqual(2)

    const aug = hexes.find((h) => h.key === '2026-08')
    const sep = hexes.find((h) => h.key === '2026-09')

    expect(aug).toBeDefined()
    expect(aug.isSealed).toBe(true)
    expect(aug.isCurrent).toBe(false)

    expect(sep).toBeDefined()
    expect(sep.isSealed).toBe(false)
    expect(sep.isCurrent).toBe(true)
    expect(sep.ecosystem).toBeDefined()
  })
})
