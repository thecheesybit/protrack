import { describe, it, expect } from 'vitest'
import { buildLeaderboardEntry } from '@/lib/leaderboard'

// Fixed "now": 2026-09-17T06:00:00 local — matches the project's working date.
const NOW = new Date(2026, 8, 17, 6, 0, 0).getTime()
const DAY = 86400000

function sess(id, durationMin, msAgo, extra = {}) {
  return {
    id,
    durationMin,
    completed: true,
    startedAt: new Date(NOW - msAgo),
    ...extra,
  }
}

describe('buildLeaderboardEntry', () => {
  it('sums weekly (rolling 7d) and monthly (calendar month) minutes', () => {
    const sessions = [
      sess('a', 25, 1 * DAY), // this week + this month
      sess('b', 25, 3 * DAY), // this week + this month
      sess('c', 25, 20 * DAY), // NOT this week; still Sep (this month, since 17-20 = late Aug -> not this month)
    ]
    const e = buildLeaderboardEntry(sessions, { displayName: 'Ayush', now: NOW })
    expect(e.weeklyMin).toBe(50)
    // c is ~28 Aug → previous month, so monthly counts only a + b
    expect(e.monthlyMin).toBe(50)
  })

  it('classifies plant types and builds compact forest snapshots', () => {
    const sessions = [
      sess('t', 25, 1 * DAY), // tree
      sess('s', 12, 2 * DAY), // shrub
      sess('f', 5, 3 * DAY), // flower
    ]
    const e = buildLeaderboardEntry(sessions, { now: NOW })
    expect(e.weeklyTrees).toBe(1)
    expect(e.weeklyShrubs).toBe(1)
    expect(e.weeklyFlowers).toBe(1)
    expect(e.weeklyForest).toHaveLength(3)
    expect(e.weeklyForest[0]).toHaveProperty('t')
    expect(e.weeklyForest[0]).toHaveProperty('s')
    // Oldest-first: flower (3d ago) before tree (1d ago)
    expect(e.weeklyForest[0].t).toBe('flower')
    expect(e.weeklyForest.at(-1).t).toBe('tree')
  })

  it('honors explicit plantType and spriteVariant', () => {
    const sessions = [sess('x', 25, 1 * DAY, { plantType: 'flower', spriteVariant: 7 })]
    const e = buildLeaderboardEntry(sessions, { now: NOW })
    expect(e.weeklyFlowers).toBe(1)
    expect(e.weeklyForest[0]).toEqual({ t: 'flower', s: 7 })
  })

  it('excludes failed / incomplete sessions', () => {
    const sessions = [
      sess('ok', 25, 1 * DAY),
      { id: 'fail', durationMin: 90, completed: false, startedAt: new Date(NOW - DAY) },
      { id: 'died', durationMin: 50, failedReason: 'x', startedAt: new Date(NOW - DAY) },
    ]
    const e = buildLeaderboardEntry(sessions, { now: NOW })
    expect(e.weeklyMin).toBe(25)
    expect(e.weeklyForest).toHaveLength(1)
  })

  it('caps the forest snapshot to maxForest, keeping the newest', () => {
    const sessions = Array.from({ length: 200 }, (_, i) => sess(`n${i}`, 25, (200 - i) * 3600000))
    const e = buildLeaderboardEntry(sessions, { now: NOW, maxForest: 120 })
    expect(e.weeklyForest.length).toBeLessThanOrEqual(120)
  })

  it('carries display-safe identity only, clamps the name, and passes through all-time/streak', () => {
    const e = buildLeaderboardEntry([], {
      displayName: 'x'.repeat(80),
      photoURL: 'https://p/a.png',
      currentStreak: 9,
      allTimeMin: 1234,
      now: NOW,
    })
    expect(e.displayName).toHaveLength(40)
    expect(e.photoURL).toBe('https://p/a.png')
    expect(e.currentStreak).toBe(9)
    expect(e.allTimeMin).toBe(1234)
    expect(e.weeklyMin).toBe(0)
    // No private fields leak in.
    expect(e).not.toHaveProperty('subjects')
    expect(e).not.toHaveProperty('todos')
  })

  it('is resilient to empty / missing input', () => {
    const e = buildLeaderboardEntry(undefined, { now: NOW })
    expect(e.weeklyMin).toBe(0)
    expect(e.monthlyForest).toEqual([])
  })
})
