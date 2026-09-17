import { describe, it, expect } from 'vitest'
import { computeVitality, getVitalityStatus, getVitalityShading } from '@/lib/ecoVitality'

describe('ecoVitality', () => {
  it('returns peak vitality (1.0) when focused today with high consistency', () => {
    const v = computeVitality({
      streak: 7,
      activeDaysThisMonth: 10,
      daysElapsedInMonth: 10,
      daysSinceLastSession: 0,
      isSealed: false,
    })
    expect(v).toBe(1.0)
    expect(getVitalityStatus(v).label).toBe('Thriving')
  })

  it('drops vitality smoothly during a multi-day lapse without data loss', () => {
    const v0 = computeVitality({ daysSinceLastSession: 0, activeDaysThisMonth: 5, daysElapsedInMonth: 10 })
    const v3 = computeVitality({ daysSinceLastSession: 3, activeDaysThisMonth: 5, daysElapsedInMonth: 10 })
    const v7 = computeVitality({ daysSinceLastSession: 7, activeDaysThisMonth: 5, daysElapsedInMonth: 10 })

    expect(v0).toBeGreaterThan(v3)
    expect(v3).toBeGreaterThan(v7)
    expect(v7).toBeGreaterThanOrEqual(0.15) // Clamped at 0.15 floor
  })

  it('recovers vitality immediately upon completing a session today', () => {
    // Parched before session
    const parched = computeVitality({ daysSinceLastSession: 8, activeDaysThisMonth: 4, daysElapsedInMonth: 14 })
    expect(parched).toBeLessThan(0.4)

    // User completes a session today
    const recovered = computeVitality({ daysSinceLastSession: 0, activeDaysThisMonth: 5, daysElapsedInMonth: 14 })
    expect(recovered).toBeGreaterThan(0.7)
  })

  it('evaluates sealed historical months based purely on final consistency', () => {
    const low = computeVitality({ activeDaysThisMonth: 2, daysElapsedInMonth: 30, isSealed: true })
    const mid = computeVitality({ activeDaysThisMonth: 15, daysElapsedInMonth: 30, isSealed: true })
    const high = computeVitality({ activeDaysThisMonth: 28, daysElapsedInMonth: 30, isSealed: true })

    expect(low).toBeLessThan(mid)
    expect(mid).toBeLessThan(high)
  })

  it('provides color grading parameters for canvas rendering', () => {
    const high = getVitalityShading(1.0)
    const low = getVitalityShading(0.2)

    expect(high.satMultiplier).toBeGreaterThan(low.satMultiplier)
    expect(low.warmTint).toBeGreaterThan(high.warmTint) // Warm parched tint
    expect(high.waterAlpha).toBeGreaterThan(low.waterAlpha)
  })
})
