/**
 * Tests for the unified sound module.
 *
 * The test env is `node`, so localStorage / window / AudioContext don't exist.
 * We install minimal stubs on the global object and re-import the module fresh
 * per test (vi.resetModules) so the load-time flag migration re-runs against
 * whatever storage state the test set up.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------
function makeStorage(initial = {}) {
  let map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => (map = new Map()),
  }
}

let oscillators
class FakeAudioContext {
  constructor() {
    FakeAudioContext.instances += 1
    this.state = 'running'
    this.currentTime = 0
    this.destination = { id: 'destination' }
  }
  resume() {}
  createOscillator() {
    const osc = {
      type: 'sine',
      frequency: {
        value: 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    oscillators.push(osc)
    return osc
  }
  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }
  }
}

const originalWindow = globalThis.window
const originalLocalStorage = globalThis.localStorage

beforeEach(() => {
  oscillators = []
  FakeAudioContext.instances = 0
  globalThis.window = { AudioContext: FakeAudioContext }
  globalThis.localStorage = makeStorage()
  // The module warns (never throws) on a broken AudioContext; keep it out of
  // the test log. Restored by vi.restoreAllMocks() in afterEach.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.resetModules()
})

afterEach(() => {
  globalThis.window = originalWindow
  globalThis.localStorage = originalLocalStorage
  vi.restoreAllMocks()
})

/** Import a pristine copy of the module for the current stub state. */
const loadSound = () => import('../sound.js')

// ---------------------------------------------------------------------------
// Flag migration (runs at import time)
// ---------------------------------------------------------------------------
describe('sounds flag migration', () => {
  it('carries a legacy mute forward when the canonical key is unset', async () => {
    globalThis.localStorage = makeStorage({ 'protrack:sounds_enabled': 'false' })
    const { soundsEnabled } = await loadSound()
    expect(globalThis.localStorage.getItem('protrack:sounds')).toBe('false')
    expect(soundsEnabled()).toBe(false)
  })

  it('does not touch the canonical key when it is already set', async () => {
    globalThis.localStorage = makeStorage({
      'protrack:sounds': 'true',
      'protrack:sounds_enabled': 'false',
    })
    const { soundsEnabled } = await loadSound()
    expect(globalThis.localStorage.getItem('protrack:sounds')).toBe('true')
    expect(soundsEnabled()).toBe(true)
  })

  it('leaves an un-muted legacy state alone (default stays on)', async () => {
    globalThis.localStorage = makeStorage({ 'protrack:sounds_enabled': 'true' })
    const { soundsEnabled } = await loadSound()
    expect(globalThis.localStorage.getItem('protrack:sounds')).toBeNull()
    expect(soundsEnabled()).toBe(true)
  })

  it('is a no-op and never throws when storage is unavailable', async () => {
    globalThis.localStorage = undefined
    const mod = await loadSound()
    expect(mod.soundsEnabled()).toBe(true)
    expect(() => mod.migrateSoundsFlag()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// soundsEnabled / setSoundsEnabled
// ---------------------------------------------------------------------------
describe('setSoundsEnabled', () => {
  it('writes the canonical key and mirrors the legacy key', async () => {
    const { setSoundsEnabled, soundsEnabled } = await loadSound()

    setSoundsEnabled(false)
    expect(globalThis.localStorage.getItem('protrack:sounds')).toBe('false')
    expect(globalThis.localStorage.getItem('protrack:sounds_enabled')).toBe('false')
    expect(soundsEnabled()).toBe(false)

    setSoundsEnabled(true)
    expect(globalThis.localStorage.getItem('protrack:sounds')).toBe('true')
    expect(globalThis.localStorage.getItem('protrack:sounds_enabled')).toBe('true')
    expect(soundsEnabled()).toBe(true)
  })

  it('defaults to enabled when nothing is stored', async () => {
    const { soundsEnabled } = await loadSound()
    expect(soundsEnabled()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// chimeForIslandKind mapping table
// ---------------------------------------------------------------------------
describe('chimeForIslandKind', () => {
  const cases = [
    ['success', 'success'],
    ['progress', 'chime'],
    ['water', 'chime'],
    ['sync-online', 'chime'],
    ['focus', 'chime'],
    ['break', 'chime'],
    ['deadline', 'error'],
    ['error', 'error'],
    ['info', 'notify'],
    ['sync-offline', 'notify'],
    [undefined, 'notify'],
    ['totally-unknown', 'notify'],
  ]

  it('maps every island kind to a sound name', async () => {
    const { chimeForIslandKind } = await loadSound()
    for (const [kind, expected] of cases) {
      expect(chimeForIslandKind(kind)).toBe(expected)
    }
  })

  it('only ever returns names the bank can play', async () => {
    const { chimeForIslandKind, playSound } = await loadSound()
    const names = new Set(cases.map(([kind]) => chimeForIslandKind(kind)))
    for (const name of names) {
      expect(() => playSound(name)).not.toThrow()
    }
  })
})

// ---------------------------------------------------------------------------
// playSound
// ---------------------------------------------------------------------------
describe('playSound', () => {
  it('is a no-op when sounds are disabled (never opens an AudioContext)', async () => {
    globalThis.localStorage = makeStorage({ 'protrack:sounds': 'false' })
    const { playSound } = await loadSound()

    playSound('chime')
    playSound('success')
    playSound('prompt')

    expect(FakeAudioContext.instances).toBe(0)
    expect(oscillators).toHaveLength(0)
  })

  it('drives the AudioContext for each known sound when enabled', async () => {
    const { playSound } = await loadSound()

    for (const name of ['chime', 'pop', 'success', 'habit', 'notify', 'error', 'prompt']) {
      playSound(name)
    }

    expect(FakeAudioContext.instances).toBeGreaterThanOrEqual(1)
    // success + habit fire 4 notes each; every sound makes at least one oscillator.
    expect(oscillators.length).toBeGreaterThanOrEqual(7)
  })

  it('ignores an unknown sound name without touching audio', async () => {
    const { playSound } = await loadSound()
    playSound('does-not-exist')
    playSound(undefined)
    expect(FakeAudioContext.instances).toBe(0)
  })

  it('never throws when no AudioContext is available', async () => {
    globalThis.window = {}
    const { playSound } = await loadSound()
    expect(() => playSound('chime')).not.toThrow()
    expect(console.warn).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Legacy re-export surface stays intact
// ---------------------------------------------------------------------------
describe('audioFX compatibility shim', () => {
  it('re-exports the four legacy effects from sound.js', async () => {
    const shim = await import('../audioFX.js')
    for (const name of ['playChime', 'playPop', 'playSuccess', 'playHabitChime']) {
      expect(typeof shim[name]).toBe('function')
    }
  })

  it('legacy effects respect the unified flag', async () => {
    globalThis.localStorage = makeStorage({ 'protrack:sounds': 'false' })
    const { playChime, playSuccess } = await import('../audioFX.js')
    playChime()
    playSuccess()
    expect(FakeAudioContext.instances).toBe(0)
  })
})
