import { describe, it, expect } from 'vitest'
import { isNoise, buildWakeRegex } from '../useVoiceAgent'

describe('useVoiceAgent helpers', () => {
  describe('isNoise', () => {
    it('treats empty or punctuation as noise', () => {
      expect(isNoise('')).toBe(true)
      expect(isNoise('   ')).toBe(true)
      expect(isNoise('...')).toBe(true)
      expect(isNoise('!?,.')).toBe(true)
    })

    it('treats non-semantic hesitation fillers as noise', () => {
      expect(isNoise('uh')).toBe(true)
      expect(isNoise('um')).toBe(true)
      expect(isNoise('ah')).toBe(true)
      expect(isNoise('er')).toBe(true)
      expect(isNoise('hm')).toBe(true)
      expect(isNoise('hmm')).toBe(true)
      expect(isNoise('uh um ah')).toBe(true)
    })

    it('preserves critical conversational affirmations and denials', () => {
      // These MUST NOT be noise, so confirmation dialogs work!
      expect(isNoise('no')).toBe(false)
      expect(isNoise('ok')).toBe(false)
      expect(isNoise('yes')).toBe(false)
      expect(isNoise('yeah')).toBe(false)
      expect(isNoise('okay')).toBe(false)
      expect(isNoise('sure')).toBe(false)
      expect(isNoise('hi')).toBe(false)
      expect(isNoise('go')).toBe(false)
      expect(isNoise('stop')).toBe(false)
    })

    it('preserves voice commands', () => {
      expect(isNoise('what is due today')).toBe(false)
      expect(isNoise('start focus on physics')).toBe(false)
      expect(isNoise('mark calculus homework done')).toBe(false)
      expect(isNoise('that is all')).toBe(false)
    })
  })

  describe('buildWakeRegex', () => {
    it('returns null for empty phrase', () => {
      expect(buildWakeRegex('')).toBeNull()
      expect(buildWakeRegex(null)).toBeNull()
    })

    it('matches configured phrase and extracts trailing command', () => {
      const re = buildWakeRegex('hey track')
      expect(re).not.toBeNull()

      const m1 = 'hey track, what is due today?'.match(re)
      expect(m1).not.toBeNull()
      expect(m1[1].trim()).toBe('what is due today?')

      const m2 = 'Hey Track'.match(re)
      expect(m2).not.toBeNull()
      expect(m2[1].trim()).toBe('')
    })

    it('tolerates leading breaths and punctuation', () => {
      const re = buildWakeRegex('track')
      const m = 'um hey track start focus'.match(re)
      expect(m).not.toBeNull()
      expect(m[1].trim()).toBe('start focus')
    })
  })
})
