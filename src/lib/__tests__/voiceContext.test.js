import { describe, it, expect } from 'vitest'
import { buildVoiceContext } from '@/lib/voiceContext'

// Fixed reference time so day-of-week / "today" derivations are deterministic.
// 2026-09-14 is a Monday → dowOf === 0 (0=Mon).
const NOW = new Date('2026-09-14T10:00:00')
const TODAY_YMD = NOW.toISOString().slice(0, 10)

describe('buildVoiceContext', () => {
  it('summarizes mode, subjects and habit completion', () => {
    const out = buildVoiceContext(
      {
        modeName: 'Exam Prep',
        modeId: 'm1',
        modes: [{ name: 'Exam Prep' }, { name: 'Fitness' }],
        subjects: [
          { name: 'Physics', progressPct: 20 },
          { name: 'History', progressPct: 80 },
        ],
        habits: [{ name: 'Meditate', doneDates: [TODAY_YMD] }],
        todos: [],
      },
      NOW,
    )
    expect(out).toContain('Exam Prep')
    expect(out).toContain('Fitness')
    // Lowest-progress subject listed first.
    expect(out.indexOf('Physics')).toBeLessThan(out.indexOf('History'))
    expect(out).toContain('Physics: 20%')
    expect(out).toContain('Meditate — done today')
  })

  it('flags overdue to-dos and formats the timetable', () => {
    const out = buildVoiceContext(
      {
        modeName: 'All',
        subjects: [],
        habits: [],
        todos: [
          { text: 'Submit essay', done: false, dueAt: '2000-01-01T09:00:00' },
          { text: 'Buy pens', done: true },
        ],
        slots: [{ dayOfWeek: 0, startMin: 540, endMin: 600, label: 'Physics lecture' }],
      },
      NOW,
    )
    expect(out).toContain('Submit essay')
    expect(out).toContain('OVERDUE')
    // done todo is filtered out
    expect(out).not.toContain('Buy pens')
    // Monday slot renders under today's schedule with a clock range
    expect(out).toContain('Physics lecture')
    expect(out).toContain('9:00 AM')
  })

  it('renders live focus timer and alarm state', () => {
    const out = buildVoiceContext(
      {
        subjects: [],
        habits: [],
        todos: [],
        focus: { status: 'running', phase: 'focus', secondsLeft: 600, session: { label: 'Physics' } },
        alarms: [{ enabled: true, time: '07:30', label: 'Wake up', repeat: 'daily' }],
      },
      NOW,
    )
    expect(out).toMatch(/Focus timer: running/)
    expect(out).toContain('Physics')
    expect(out).toContain('7:30 AM')
    expect(out).toContain('Wake up')
  })

  it('handles an empty workspace without throwing', () => {
    const out = buildVoiceContext({}, NOW)
    expect(out).toContain('Focus timer: idle')
    expect(out).toContain('Alarms: none set.')
    expect(typeof out).toBe('string')
  })
})
