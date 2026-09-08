/**
 * Tests for the tiered TTS utility.
 *
 * The test env is `node`, so window / localStorage / SpeechSynthesis / Audio /
 * fetch don't exist — we install minimal stubs on globalThis (same approach as
 * sound.test.js) and restore them afterwards.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/services/geminiService', () => ({
  getElevenLabsKey: vi.fn(() => ''),
  getOpenAIKey: vi.fn(() => ''),
}))

import {
  getPreferredVoice,
  tierOrder,
  speak,
  stopSpeaking,
  getVoicePreference,
  setVoicePreference,
  setProviderPreference,
} from '@/lib/tts'
import { getElevenLabsKey, getOpenAIKey } from '@/services/geminiService'

/* ── stubs ───────────────────────────────────────────────── */

function makeStorage(initial = {}) {
  let map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => (map = new Map()),
  }
}

function fakeVoice(name, lang, extra = {}) {
  return { name, lang, voiceURI: name, default: false, localService: true, ...extra }
}

class FakeUtterance {
  constructor(text) {
    this.text = text
    this.lang = ''
    this.rate = 1
    this.pitch = 1
    this.volume = 1
    this.voice = null
  }
}

class FakeAudio {
  constructor(src) {
    this.src = src
    this.volume = 1
  }
  play() {
    return Promise.resolve()
  }
  pause() {}
}

const orig = {
  window: globalThis.window,
  localStorage: globalThis.localStorage,
  SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance,
  Audio: globalThis.Audio,
  fetch: globalThis.fetch,
  createObjectURL: globalThis.URL.createObjectURL,
  revokeObjectURL: globalThis.URL.revokeObjectURL,
}

let spoken
let voices

beforeEach(() => {
  voices = [
    fakeVoice('Microsoft David Desktop', 'en-US'),
    fakeVoice('eSpeak English', 'en'),
    fakeVoice('Microsoft Aria Online (Natural)', 'en-US', { localService: false }),
    fakeVoice('Google UK English Female', 'en-GB', { localService: false }),
    fakeVoice('Google हिन्दी', 'hi-IN', { localService: false }),
  ]
  spoken = []
  globalThis.SpeechSynthesisUtterance = FakeUtterance
  globalThis.Audio = FakeAudio
  globalThis.window = {
    speechSynthesis: {
      getVoices: () => voices,
      speak: (u) => spoken.push(u),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
    },
  }
  globalThis.localStorage = makeStorage()
  globalThis.fetch = vi.fn()
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake')
  globalThis.URL.revokeObjectURL = vi.fn()
  getElevenLabsKey.mockReturnValue('')
  getOpenAIKey.mockReturnValue('')
  setVoicePreference('')
  setProviderPreference('auto')
  // The util warns (never throws) when a tier fails; keep it out of the log.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  globalThis.window = orig.window
  globalThis.localStorage = orig.localStorage
  globalThis.SpeechSynthesisUtterance = orig.SpeechSynthesisUtterance
  globalThis.Audio = orig.Audio
  globalThis.fetch = orig.fetch
  globalThis.URL.createObjectURL = orig.createObjectURL
  globalThis.URL.revokeObjectURL = orig.revokeObjectURL
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

/* ── getPreferredVoice ───────────────────────────────────── */

describe('getPreferredVoice', () => {
  it('prefers a neural/"Natural" voice over a plain desktop one', () => {
    expect(getPreferredVoice('en-US').name).toBe('Microsoft Aria Online (Natural)')
  })

  it('never returns a robotic espeak voice as the best match', () => {
    voices = [fakeVoice('eSpeak English', 'en-US'), fakeVoice('Microsoft Zira Desktop', 'en-US')]
    expect(getPreferredVoice('en-US').name).toBe('Microsoft Zira Desktop')
  })

  it('matches the requested language family', () => {
    expect(getPreferredVoice('hi-IN').name).toBe('Google हिन्दी')
  })

  it('honours a stored voice preference when it is installed', () => {
    setVoicePreference('Google UK English Female')
    expect(getPreferredVoice('en-US').name).toBe('Google UK English Female')
  })

  it('falls back to the first voice when nothing matches the language', () => {
    expect(getPreferredVoice('fr-FR')).toBe(voices[0])
  })
})

/* ── tierOrder ───────────────────────────────────────────── */

describe('tierOrder', () => {
  it('auto = ElevenLabs → OpenAI → Web', () => {
    expect(tierOrder('auto')).toEqual(['elevenlabs', 'openai', 'web'])
  })
  it('a pinned provider still keeps Web as the safety net', () => {
    expect(tierOrder('elevenlabs')).toEqual(['elevenlabs', 'web'])
    expect(tierOrder('openai')).toEqual(['openai', 'web'])
  })
  it('web-only pins to Web', () => {
    expect(tierOrder('web')).toEqual(['web'])
  })
})

/* ── speak() ─────────────────────────────────────────────── */

describe('speak', () => {
  it('is a no-op that still resolves + calls onEnd when voice is disabled', async () => {
    const onEnd = vi.fn()
    await speak('hello', { voiceEnabled: false, onEnd })
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(spoken).toHaveLength(0)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('with no provider keys, speaks via Web Speech at natural rate/pitch', async () => {
    await speak('focus on one thing', { lang: 'en-US' })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(spoken).toHaveLength(1)
    expect(spoken[0].rate).toBe(1.0)
    expect(spoken[0].pitch).toBe(1.0)
    expect(spoken[0].voice.name).toBe('Microsoft Aria Online (Natural)')
  })

  it('uses ElevenLabs first when its key is set', async () => {
    getElevenLabsKey.mockReturnValue('el-key')
    globalThis.fetch.mockResolvedValue({ ok: true, blob: async () => ({}) })
    await speak('hi there')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.mock.calls[0][0]).toContain('api.elevenlabs.io')
    expect(spoken).toHaveLength(0) // remote audio, not Web Speech
  })

  it('falls back to OpenAI, then Web Speech, as tiers fail', async () => {
    getElevenLabsKey.mockReturnValue('el-key')
    getOpenAIKey.mockReturnValue('oa-key')
    globalThis.fetch
      .mockResolvedValueOnce({ ok: false, status: 429 }) // ElevenLabs rejected
      .mockRejectedValueOnce(new Error('network')) // OpenAI threw
    await speak('keep going')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[1][0]).toContain('api.openai.com')
    expect(spoken).toHaveLength(1) // finally spoke locally
  })

  it('respects a pinned "web" provider preference and skips remote calls', async () => {
    getElevenLabsKey.mockReturnValue('el-key')
    setProviderPreference('web')
    await speak('local only')
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(spoken).toHaveLength(1)
  })
})

/* ── stopSpeaking ────────────────────────────────────────── */

describe('stopSpeaking', () => {
  it('cancels the speech synth queue', () => {
    stopSpeaking()
    expect(globalThis.window.speechSynthesis.cancel).toHaveBeenCalled()
  })
})

/* ── preferences ─────────────────────────────────────────── */

describe('voice preference round-trip', () => {
  it('stores and clears', () => {
    setVoicePreference('Some Voice')
    expect(getVoicePreference()).toBe('Some Voice')
    setVoicePreference('')
    expect(getVoicePreference()).toBe('')
  })
})
