import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getGeminiKey,
  setGeminiKey,
  getApiKey,
  setApiKey,
  isRetryableGeminiError,
  executeGeminiWithModelFallback,
  chatWithGemini,
  chatWithGeminiStream,
  GEMINI_MODELS,
} from '../geminiService'

const storageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value)
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    writable: true,
  })
}

describe('geminiService Key Persistence & Resilience', () => {
  beforeEach(() => {
    localStorage.clear()
    setGeminiKey('')
  })

  it('persists Gemini key in localStorage and in-memory cache', () => {
    setGeminiKey('AIzaSyTestKey123456789')
    expect(getGeminiKey()).toBe('AIzaSyTestKey123456789')
    expect(localStorage.getItem('protrack:persistent_gemini_key')).toBe('AIzaSyTestKey123456789')

    // Manually clearing an empty string should clear it
    setGeminiKey('')
    expect(getGeminiKey()).toBe('')
    expect(localStorage.getItem('protrack:persistent_gemini_key')).toBeNull()
  })

  it('correctly classifies retryable transient Gemini errors', () => {
    expect(isRetryableGeminiError(new Error('[503] This model is currently experiencing high demand.'))).toBe(true)
    expect(isRetryableGeminiError({ status: 503, message: 'Service Unavailable' })).toBe(true)
    expect(isRetryableGeminiError(new Error('Resource has been exhausted (e.g. check quota).'))).toBe(true)
    expect(isRetryableGeminiError(new Error('404 Not Found'))).toBe(true)
    expect(isRetryableGeminiError(new Error('Invalid API key'))).toBe(false)
  })

  it('falls back to the next model when the preferred one stays overloaded', async () => {
    setGeminiKey('AIzaSyMockKey')

    const preferred = GEMINI_MODELS[0]
    const next = GEMINI_MODELS[1]
    const attemptedModels = []
    const mockTask = vi.fn(async (ai, modelName) => {
      attemptedModels.push(modelName)
      if (modelName === preferred) {
        const err = new Error('[503] This model is currently experiencing high demand.')
        err.status = 503
        throw err
      }
      return `Success with ${modelName}`
    })

    const result = await executeGeminiWithModelFallback('AIzaSyMockKey', mockTask)
    expect(result).toBe(`Success with ${next}`)
    // preferred model is retried once before moving on, then the next succeeds
    expect(attemptedModels.slice(0, 2)).toEqual([preferred, preferred])
    expect(attemptedModels[2]).toBe(next)
  })

  it('lists only concrete, current model ids (no -latest aliases, no retired 1.5)', () => {
    expect(GEMINI_MODELS).not.toContain('gemini-flash-latest')
    expect(GEMINI_MODELS.some((m) => m.includes('1.5'))).toBe(false)
    expect(GEMINI_MODELS[0]).toBe('gemini-2.5-flash')
  })

  it('exports chatWithGeminiStream and chatWithGemini functions', () => {
    expect(typeof chatWithGeminiStream).toBe('function')
    expect(typeof chatWithGemini).toBe('function')
  })

  it('throws helpful error if API key is missing when starting chatWithGeminiStream', async () => {
    setGeminiKey('')
    await expect(chatWithGeminiStream([{ role: 'user', text: 'hello' }], '')).rejects.toThrow(
      /Gemini key missing|Add your Gemini API key|No working AI provider/
    )
  })
})
