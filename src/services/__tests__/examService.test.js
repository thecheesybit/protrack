import { describe, it, expect } from 'vitest'
import {
  EXAM_RETENTION_DAYS,
  getExamDaysRemaining,
} from '../examService'

describe('examService 15-Day Soft Delete & Retention', () => {
  it('has 15-day retention constant', () => {
    expect(EXAM_RETENTION_DAYS).toBe(15)
  })

  it('calculates days remaining correctly', () => {
    // Just deleted now -> 15 days remaining
    expect(getExamDaysRemaining(new Date().toISOString())).toBe(15)

    // Deleted 5 days ago -> 10 days remaining
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(getExamDaysRemaining(fiveDaysAgo)).toBe(10)

    // Deleted 14 days and 20 hours ago -> 1 day remaining
    const almostExpired = new Date(Date.now() - (14 * 24 + 20) * 60 * 60 * 1000).toISOString()
    expect(getExamDaysRemaining(almostExpired)).toBe(1)

    // Deleted 16 days ago -> 0 days remaining (expired)
    const expired = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString()
    expect(getExamDaysRemaining(expired)).toBe(0)

    // Null or undefined deletedAt defaults to full window
    expect(getExamDaysRemaining(null)).toBe(15)
  })
})
