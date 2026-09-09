import { describe, it, expect } from 'vitest'
import { FOREST_MOTIVATIONS } from '../ZenOverlay'

describe('ZenOverlay motivations', () => {
  it('contains uplifting, growth-focused affirmations for forest sanctuary mode', () => {
    expect(Array.isArray(FOREST_MOTIVATIONS)).toBe(true)
    expect(FOREST_MOTIVATIONS.length).toBeGreaterThanOrEqual(5)
    FOREST_MOTIVATIONS.forEach((m) => {
      expect(typeof m).toBe('string')
      expect(m.length).toBeGreaterThan(15)
    })
  })

  it('includes core growth & discipline themes', () => {
    const combined = FOREST_MOTIVATIONS.join(' ').toLowerCase()
    expect(combined).toContain('focus')
    expect(combined).toContain('discipline')
    expect(combined).toContain('perseverance')
  })
})
