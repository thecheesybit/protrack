import { describe, it, expect } from 'vitest'
import {
  filterSuccessfulSessions,
  getTreeTooltip,
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
    // Every single successful session must be included so it gets its own tree
    expect(result).toHaveLength(7)
  })

  it('returns empty array when sessions is null or empty', () => {
    expect(filterSuccessfulSessions(null, targetDate)).toEqual([])
    expect(filterSuccessfulSessions([], targetDate)).toEqual([])
  })
})

describe('CalendarForest - Tooltip Formatting', () => {
  it('formats tooltip with duration, deep focus distinction, and session index', () => {
    const session = {
      id: 's1',
      durationMin: 50,
      label: 'Calculus Review',
      startedAt: new Date('2026-09-07T10:30:00'),
    }

    const tooltip = getTreeTooltip(session, 1, 4)
    expect(tooltip.title).toBe('50m Deep Focus')
    expect(tooltip.detail).toContain('Calculus Review')
    expect(tooltip.detail).toContain('Tree 2 of 4')
  })

  it('falls back gracefully when label is not provided', () => {
    const session = {
      id: 's2',
      durationMin: 25,
      modeId: 'Study',
      startedAt: new Date('2026-09-07T15:00:00'),
    }

    const tooltip = getTreeTooltip(session, 0, 1)
    expect(tooltip.title).toBe('25m Focus')
    expect(tooltip.detail).toContain('Study session')
    expect(tooltip.detail).toContain('Tree 1 of 1')
  })
})
