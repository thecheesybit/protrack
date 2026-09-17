import { describe, it, expect, beforeEach } from 'vitest'
import {
  isMonthSealed,
  sealMonth,
  loadMonthRollups,
  saveMonthRollup,
  saveAllMonthRollups,
} from '@/lib/ecoRollup'
import { deriveWorldHexes } from '@/lib/forestWorld'

describe('ecoRollup Sealed Month Preservation', () => {
  beforeEach(() => {
    saveAllMonthRollups('test-user', {})
  })

  it('correctly determines whether a month is sealed (in the past)', () => {
    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth()

    expect(isMonthSealed(curYear - 1, 11)).toBe(true)
    expect(isMonthSealed(curYear, curMonth)).toBe(false)
    expect(isMonthSealed(curYear + 1, 0)).toBe(false)
  })

  it('seals a month into a permanent frozen rollup snapshot', () => {
    const monthSessions = [
      { id: 's1', durationMin: 25, completed: true, startedAt: new Date(2026, 6, 5) },
      { id: 's2', durationMin: 12, completed: true, startedAt: new Date(2026, 6, 8) },
      { id: 's3', durationMin: 5, completed: true, startedAt: new Date(2026, 6, 12) },
    ]

    const rollup = sealMonth({
      uid: 'test-user',
      year: 2026,
      month: 6, // July (0-indexed)
      totalMin: 42,
      activeDays: 3,
      monthSessions,
      currentStreak: 0,
    })

    expect(rollup.key).toBe('2026-07')
    expect(rollup.isSealed).toBe(true)
    expect(rollup.counts.trees).toBe(1)
    expect(rollup.counts.shrubs).toBe(1)
    expect(rollup.counts.flowers).toBe(1)
    expect(rollup.counts.total).toBe(3)
    expect(rollup.miniItems).toHaveLength(3)
    expect(rollup.vitalityAtSeal).toBeGreaterThan(0)
    expect(rollup.ecosystem.isSealed).toBe(true)

    // Verify stored and reloadable
    const loaded = loadMonthRollups('test-user')
    expect(loaded['2026-07']).toBeDefined()
    expect(loaded['2026-07'].totalMin).toBe(42)
  })

  it('preserves historical months in deriveWorldHexes even if sessions drop out of window', () => {
    const now = new Date(2026, 8, 17) // Sep 17, 2026

    // Pre-seal July 2026
    sealMonth({
      uid: 'test-user-2',
      year: 2026,
      month: 6,
      totalMin: 120,
      activeDays: 4,
      monthSessions: [{ id: 'old-1', durationMin: 60 }],
    })

    // Now call deriveWorldHexes with sessions ONLY for current month (Sep)
    const sessions = [
      { id: 'now-1', durationMin: 30, startedAt: new Date(2026, 8, 10), completed: true },
    ]

    const hexes = deriveWorldHexes(sessions, { uid: 'test-user-2', now })

    // July 2026 must still exist on the continent despite 0 sessions passed in
    const julyHex = hexes.find((h) => h.key === '2026-07')
    expect(julyHex).toBeDefined()
    expect(julyHex.isSealed).toBe(true)
    expect(julyHex.totalHours).toBe(2) // 120min = 2h

    // Continuous spiral gap handling (A3): August 2026 was between July and Sept, so it must be present as dormant Tier 0
    const augHex = hexes.find((h) => h.key === '2026-08')
    expect(augHex).toBeDefined()
    expect(augHex.isDormant).toBe(true)
    expect(augHex.ecosystem.tier.level).toBe(0)
    expect(augHex.ecosystem.tier.name).toBe('Bare Substrate')

    // Current month must be present
    const sepHex = hexes.find((h) => h.key === '2026-09')
    expect(sepHex).toBeDefined()
    expect(sepHex.isCurrent).toBe(true)
    expect(sepHex.isDormant).toBe(false)
  })
})
