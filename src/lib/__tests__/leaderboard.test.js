import { describe, it, expect } from 'vitest'
import {
  buildLeaderboardEntry,
  isLeaderboardOptedOut,
  needsLeaderboardNotice,
  LEADERBOARD_OPT_OUT_ENABLED,
  isLeaderboardDataReady,
  leaderboardSignature,
  resolveLeaderboard,
} from '@/lib/leaderboard'

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
    expect(e.monthKey).toBe('2026-09')
    expect(e.weeklyMin).toBe(50)
    // c is ~28 Aug → previous month, so monthly counts only a + b
    expect(e.monthlyMin).toBe(50)
    // and c is preserved in lastMonth
    expect(e.lastMonth).toEqual(
      expect.objectContaining({
        monthKey: '2026-08',
        monthlyMin: 25,
      }),
    )
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

describe('leaderboard opt-out pause', () => {
  it('ignores a stored opt-out while opt-out is paused', () => {
    expect(isLeaderboardOptedOut({ leaderboardOptOut: true }, false)).toBe(false)
    expect(isLeaderboardOptedOut({ leaderboardOptOut: true }, true)).toBe(true)
    expect(isLeaderboardOptedOut(null, true)).toBe(false)
  })

  it('re-notifies previously opted-out users while paused', () => {
    expect(needsLeaderboardNotice({ leaderboardNoticeSeen: true, leaderboardOptOut: true }, false)).toBe(true)
    expect(needsLeaderboardNotice({ leaderboardNoticeSeen: true, leaderboardOptOut: false }, false)).toBe(false)
    expect(needsLeaderboardNotice({}, false)).toBe(true)
    expect(needsLeaderboardNotice(null, false)).toBe(false)
  })

  it('keeps opted-out users hidden (no notice) when opt-out is enabled', () => {
    expect(needsLeaderboardNotice({ leaderboardNoticeSeen: true, leaderboardOptOut: true }, true)).toBe(false)
    expect(needsLeaderboardNotice({ leaderboardNoticeSeen: false }, true)).toBe(true)
  })

  it('ships with opt-out paused', () => {
    expect(LEADERBOARD_OPT_OUT_ENABLED).toBe(false)
  })
})

describe('isLeaderboardDataReady', () => {
  const s = [{ durationMin: 25 }]
  it('waits for the session listener and stats', () => {
    expect(isLeaderboardDataReady({ sessions: s, sessionsLoading: true, stats: {} })).toBe(false)
    expect(isLeaderboardDataReady({ sessions: s, sessionsLoading: false, stats: null })).toBe(false)
  })
  it('refuses an empty session list when stats show focus history', () => {
    expect(isLeaderboardDataReady({ sessions: [], sessionsLoading: false, stats: { totalFocusMin: 1871 } })).toBe(false)
  })
  it('allows a genuinely new user and a loaded history', () => {
    expect(isLeaderboardDataReady({ sessions: [], sessionsLoading: false, stats: { totalFocusMin: 0 } })).toBe(true)
    expect(isLeaderboardDataReady({ sessions: s, sessionsLoading: false, stats: { totalFocusMin: 25 } })).toBe(true)
  })
})

describe('leaderboardSignature', () => {
  const entry = buildLeaderboardEntry([], { displayName: 'A', now: NOW })
  it('changes with the day so stale entries get refreshed daily', () => {
    expect(leaderboardSignature('u', entry, '2026-09-25')).not.toBe(leaderboardSignature('u', entry, '2026-09-26'))
    expect(leaderboardSignature('u', entry, '2026-09-25')).toBe(leaderboardSignature('u', entry, '2026-09-25'))
  })
  it('changes when the month rolls over', () => {
    const octEntry = { ...entry, monthKey: '2026-10' }
    expect(leaderboardSignature('u', entry, '2026-10-01')).not.toBe(leaderboardSignature('u', octEntry, '2026-10-01'))
  })
})

describe('resolveLeaderboard (month reset & preservation)', () => {
  const OCT_1 = new Date(2026, 9, 1, 10, 0, 0).getTime() // Oct 1, 2026

  it('resets current month minutes to 0 for users who have not focused in October yet', () => {
    const rawEntries = [
      {
        uid: 'user-krishnansh',
        displayName: 'Krishnansh Singh',
        monthlyMin: 3053, // 50h 53m in Sept
        monthlyTrees: 101,
        weeklyMin: 1064,
        updatedAt: new Date(2026, 8, 30, 20, 0, 0), // Sept 30
      },
      {
        uid: 'user-nishtha',
        displayName: 'Nishtha Bhushan',
        monthlyMin: 25,
        monthlyTrees: 1,
        weeklyMin: 25,
        updatedAt: new Date(2026, 8, 30, 21, 0, 0),
      },
      {
        uid: 'user-ayush',
        displayName: 'Ayush Kumar',
        monthKey: '2026-10', // already published in October!
        monthlyMin: 25,
        monthlyTrees: 1,
        weeklyMin: 60,
        lastMonth: {
          monthKey: '2026-09',
          monthlyMin: 500,
          monthlyTrees: 20,
        },
        updatedAt: new Date(2026, 9, 1, 9, 0, 0),
      },
    ]

    const resolved = resolveLeaderboard(rawEntries, { now: OCT_1, userUid: 'user-ayush' })

    expect(resolved.currentMonthKey).toBe('2026-10')
    expect(resolved.lastMonthKey).toBe('2026-09')

    // Find each user in the resolved list
    const krish = resolved.entries.find((e) => e.uid === 'user-krishnansh')
    const nish = resolved.entries.find((e) => e.uid === 'user-nishtha')
    const ayush = resolved.entries.find((e) => e.uid === 'user-ayush')

    // 1. Current month (October) MUST be reset for September publishers:
    expect(krish.monthlyMin).toBe(0)
    expect(krish.monthlyTrees).toBe(0)
    expect(nish.monthlyMin).toBe(0)
    expect(nish.monthlyTrees).toBe(0)

    // Ayush published in October, so his October minutes are active:
    expect(ayush.monthlyMin).toBe(25)

    // 2. Last month (September) MUST be preserved:
    expect(krish.lastMonthMin).toBe(3053)
    expect(krish.lastMonthTrees).toBe(101)
    expect(nish.lastMonthMin).toBe(25)
    expect(ayush.lastMonthMin).toBe(500)

    // 3. Last month champion MUST be Krishnansh (topped with 3053 min):
    expect(resolved.champion).not.toBeNull()
    expect(resolved.champion.uid).toBe('user-krishnansh')
    expect(resolved.champion.displayName).toBe('Krishnansh Singh')
    expect(resolved.champion.monthlyMin).toBe(3053)

    // Krishnansh must have the champion badge attached:
    expect(krish.isLastMonthChampion).toBe(true)
    expect(krish.championBadge).toEqual(
      expect.objectContaining({
        monthKey: '2026-09',
        label: "Sep '26 Champion",
      }),
    )

    // Ayush is not the champion:
    expect(ayush.isLastMonthChampion).toBe(false)
    expect(resolved.isUserChampion).toBe(false)
  })

  it('recognizes when the current user is the monthly champion', () => {
    const rawEntries = [
      {
        uid: 'user-ayush',
        displayName: 'Ayush Kumar',
        monthlyMin: 5000,
        monthKey: '2026-09',
        updatedAt: new Date(2026, 8, 30),
      },
      {
        uid: 'user-other',
        displayName: 'Other',
        monthlyMin: 1000,
        monthKey: '2026-09',
        updatedAt: new Date(2026, 8, 30),
      },
    ]

    const resolved = resolveLeaderboard(rawEntries, { now: OCT_1, userUid: 'user-ayush' })
    expect(resolved.champion.uid).toBe('user-ayush')
    expect(resolved.isUserChampion).toBe(true)
    const ayush = resolved.entries.find((e) => e.uid === 'user-ayush')
    expect(ayush.isLastMonthChampion).toBe(true)
    expect(ayush.championBadge.label).toBe("Sep '26 Champion")
  })

  it('decays weekly minutes to 0 for entries older than 7 days', () => {
    const rawEntries = [
      {
        uid: 'stale-user',
        weeklyMin: 300,
        updatedAt: new Date(OCT_1 - 10 * DAY), // 10 days ago
      },
      {
        uid: 'fresh-user',
        weeklyMin: 300,
        updatedAt: new Date(OCT_1 - 2 * DAY), // 2 days ago
      },
    ]
    const resolved = resolveLeaderboard(rawEntries, { now: OCT_1 })
    expect(resolved.entries.find((e) => e.uid === 'stale-user').weeklyMin).toBe(0)
    expect(resolved.entries.find((e) => e.uid === 'fresh-user').weeklyMin).toBe(300)
  })
})

