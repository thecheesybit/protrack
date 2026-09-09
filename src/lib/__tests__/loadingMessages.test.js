import { describe, it, expect } from 'vitest'
import { LOADING_MESSAGES, getRandomLoadingMessage } from '../loadingMessages'

describe('loadingMessages', () => {
  it('contains at least 10 inspiring loading messages', () => {
    expect(Array.isArray(LOADING_MESSAGES)).toBe(true)
    expect(LOADING_MESSAGES.length).toBeGreaterThanOrEqual(10)
    LOADING_MESSAGES.forEach((msg) => {
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(10)
    })
  })

  it('getRandomLoadingMessage returns a message from the list', () => {
    const msg = getRandomLoadingMessage()
    expect(LOADING_MESSAGES).toContain(msg)
  })
})
