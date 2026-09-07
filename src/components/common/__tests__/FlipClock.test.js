import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  BASE_CLOCK_WIDTH,
  BASE_CLOCK_HEIGHT,
  DEFAULT_SCALE,
  getDefaultPos,
  readInitialPos,
  readInitialScale,
} from '../FlipClock'

describe('FlipClock defaults and positioning', () => {
  let store = {}

  beforeEach(() => {
    store = {}
    global.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v) },
      removeItem: (k) => { delete store[k] },
      clear: () => { store = {} },
    }
    global.window = {
      innerWidth: 1536,
      innerHeight: 825,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
  })

  afterEach(() => {
    store = {}
  })

  it('provides default scale of 1.25 matching bottom row card proportions', () => {
    expect(DEFAULT_SCALE).toBe(1.25)
    expect(readInitialScale()).toBe(1.25)
  })

  it('calculates default position anchored in bottom-left', () => {
    const pos = getDefaultPos(1.25)
    expect(pos.x).toBe(24) // Aligned with sidebar rail
    // Height = 88 * 1.25 = 110. 825 - 110 - 28 = 687
    expect(pos.y).toBe(687)
  })

  it('reads initial pos fallback when localStorage is empty', () => {
    const pos = readInitialPos(1.25)
    expect(pos.x).toBe(24)
    expect(pos.y).toBe(687)
  })

  it('migrates legacy hardcoded x: 12 to new default position', () => {
    localStorage.setItem('protrack:clock_pos', JSON.stringify({ x: 12, y: 705 }))
    const pos = readInitialPos(1.25)
    expect(pos.x).toBe(24)
    expect(pos.y).toBe(687)
  })

  it('migrates legacy scale: 1 to new DEFAULT_SCALE (1.25)', () => {
    localStorage.setItem('protrack:clock_scale', '1')
    expect(readInitialScale()).toBe(1.25)
  })

  it('preserves user custom saved position when not the legacy default', () => {
    localStorage.setItem('protrack:clock_pos', JSON.stringify({ x: 100, y: 200 }))
    const pos = readInitialPos(1.25)
    expect(pos.x).toBe(100)
    expect(pos.y).toBe(200)
  })

  it('preserves user custom scale when not the legacy default', () => {
    localStorage.setItem('protrack:clock_scale', '1.6')
    expect(readInitialScale()).toBe(1.6)
  })

  it('calculates correct dimensions at DEFAULT_SCALE', () => {
    const scaledWidth = BASE_CLOCK_WIDTH * DEFAULT_SCALE
    const scaledHeight = BASE_CLOCK_HEIGHT * DEFAULT_SCALE
    expect(scaledWidth).toBe(210)
    expect(scaledHeight).toBe(110)
  })
})
