import { describe, it, expect } from 'vitest'
import { parseCapture, dateToDow, dateToMinutes } from '../nlParse.js'

// Fixed reference date: Monday, June 17, 2024 at 8:00 AM local time.
// Using the local-time constructor avoids timezone drift in the assertions.
const REF = new Date(2024, 5, 17, 8, 0, 0)

describe('parseCapture', () => {
  it('returns empty result for empty input', () => {
    const result = parseCapture('')
    expect(result).toEqual({ date: null, endDate: null, title: '', matched: null })
  })

  it('handles null/undefined gracefully', () => {
    expect(parseCapture(null)).toEqual({ date: null, endDate: null, title: '', matched: null })
    expect(parseCapture(undefined)).toEqual({ date: null, endDate: null, title: '', matched: null })
  })

  it('preserves original text as title when no date phrase is found', () => {
    const result = parseCapture('Review lecture notes', REF)
    expect(result.date).toBeNull()
    expect(result.matched).toBeNull()
    expect(result.title).toBe('Review lecture notes')
  })

  it('parses a specific time and strips it from the title', () => {
    const result = parseCapture('Physics revision at 5pm', REF)
    expect(result.date).not.toBeNull()
    expect(result.date.getHours()).toBe(17)
    expect(result.title).not.toMatch(/5pm/i)
    expect(result.title.trim()).toBeTruthy()
  })

  it('parses "tomorrow" relative to the reference date (June 17 → June 18)', () => {
    const result = parseCapture('Submit assignment tomorrow', REF)
    expect(result.date).not.toBeNull()
    expect(result.date.getDate()).toBe(18)
    expect(result.date.getMonth()).toBe(5) // June
    expect(result.title).not.toMatch(/tomorrow/i)
  })

  it('populates endDate when a range is given', () => {
    const result = parseCapture('Study 2pm to 4pm', REF)
    expect(result.date).not.toBeNull()
    expect(result.date.getHours()).toBe(14)
    expect(result.endDate).not.toBeNull()
    expect(result.endDate.getHours()).toBe(16)
  })

  it('sets matched to the extracted date phrase', () => {
    const result = parseCapture('Meeting next Monday', REF)
    expect(result.matched).not.toBeNull()
    expect(typeof result.matched).toBe('string')
  })

  it('uses the provided ref date for "next week" resolution', () => {
    const result = parseCapture('Submit next Monday', REF)
    // REF is Monday June 17 — "next Monday" should be June 24
    expect(result.date).not.toBeNull()
    expect(result.date.getMonth()).toBe(5) // still June (next Mon = June 24)
    expect(result.date.getDate()).toBe(24)
  })
})

describe('dateToDow', () => {
  // June 16, 2024 = Sunday (JS getDay() → 0)
  it('maps Sunday (JS 0) → 6', () => {
    expect(dateToDow(new Date(2024, 5, 16))).toBe(6)
  })

  // June 17, 2024 = Monday (JS getDay() → 1)
  it('maps Monday (JS 1) → 0', () => {
    expect(dateToDow(new Date(2024, 5, 17))).toBe(0)
  })

  // June 18, 2024 = Tuesday (JS getDay() → 2)
  it('maps Tuesday (JS 2) → 1', () => {
    expect(dateToDow(new Date(2024, 5, 18))).toBe(1)
  })

  // June 22, 2024 = Saturday (JS getDay() → 6)
  it('maps Saturday (JS 6) → 5', () => {
    expect(dateToDow(new Date(2024, 5, 22))).toBe(5)
  })

  it('satisfies the formula (getDay()+6)%7 for all weekdays', () => {
    // 7-day window starting from REF (Monday)
    for (let i = 0; i < 7; i++) {
      const d = new Date(2024, 5, 17 + i)
      expect(dateToDow(d)).toBe((d.getDay() + 6) % 7)
    }
  })
})

describe('dateToMinutes', () => {
  it('returns 0 for midnight', () => {
    expect(dateToMinutes(new Date(2024, 5, 15, 0, 0))).toBe(0)
  })

  it('returns 570 for 9:30am', () => {
    expect(dateToMinutes(new Date(2024, 5, 15, 9, 30))).toBe(570)
  })

  it('returns 720 for noon', () => {
    expect(dateToMinutes(new Date(2024, 5, 15, 12, 0))).toBe(720)
  })

  it('returns 1439 for 23:59', () => {
    expect(dateToMinutes(new Date(2024, 5, 15, 23, 59))).toBe(1439)
  })
})
