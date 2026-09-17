import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  BASE_CLOCK_WIDTH,
  BASE_CLOCK_HEIGHT,
  DEFAULT_SCALE,
  CENTERED_SCALE,
  getDefaultPos,
  getCenteredPos,
  readInitialPos,
  readInitialScale,
  clampToViewport,
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

  it('provides an enlarged default scale of 1.5 for a legible desk clock', () => {
    expect(DEFAULT_SCALE).toBe(1.5)
    expect(readInitialScale()).toBe(1.5)
  })

  it('calculates default position anchored in bottom-left with a symmetric margin', () => {
    const pos = getDefaultPos(1.25)
    expect(pos.x).toBe(24) // CLOCK_MARGIN, matches the bottom gutter
    // Height = 88 * 1.25 = 110. 825 - 110 - 24 (CLOCK_MARGIN) = 691
    expect(pos.y).toBe(691)
  })

  it('reads initial pos fallback when localStorage is empty', () => {
    const pos = readInitialPos(1.25)
    expect(pos.x).toBe(24)
    expect(pos.y).toBe(691)
  })

  it('ignores any stored position and always launches at the home dock', () => {
    // Position is no longer persisted across launches — the placement resets to
    // home every time the app opens, so a stored value is disregarded.
    localStorage.setItem('protrack:clock_pos', JSON.stringify({ x: 12, y: 705 }))
    const pos = readInitialPos(1.25)
    expect(pos.x).toBe(24)
    expect(pos.y).toBe(691)
  })

  it('migrates legacy scale: 1 to new DEFAULT_SCALE (1.5)', () => {
    localStorage.setItem('protrack:clock_scale', '1')
    expect(readInitialScale()).toBe(1.5)
  })

  it('resets to the home dock each launch, disregarding a stored custom position', () => {
    localStorage.setItem('protrack:clock_pos', JSON.stringify({ x: 100, y: 200 }))
    const pos = readInitialPos(1.25)
    expect(pos.x).toBe(24)
    expect(pos.y).toBe(691)
  })

  it('never launches off-screen even if a huge stale position was stored (position not persisted)', () => {
    // A position saved on a bigger window used to strand the clock off-screen;
    // now it always starts at the in-viewport home dock.
    localStorage.setItem('protrack:clock_pos', JSON.stringify({ x: 5000, y: 5000 }))
    const pos = readInitialPos(1.25)
    expect(pos.x).toBe(24)
    expect(pos.y).toBe(691)
  })

  it('clampToViewport keeps an already-visible position unchanged', () => {
    expect(clampToViewport({ x: 100, y: 200 }, 1.25)).toEqual({ x: 100, y: 200 })
  })

  it('clampToViewport pulls a negative position back to the top-left edge', () => {
    expect(clampToViewport({ x: -80, y: -40 }, 1.25)).toEqual({ x: 0, y: 0 })
  })

  it('clampToViewport is a no-op when window is unavailable (SSR/tests)', () => {
    const saved = global.window
    global.window = undefined
    expect(clampToViewport({ x: 5000, y: 5000 }, 1.25)).toEqual({ x: 5000, y: 5000 })
    global.window = saved
  })

  it('preserves user custom scale when not the legacy default', () => {
    localStorage.setItem('protrack:clock_scale', '1.6')
    expect(readInitialScale()).toBe(1.6)
  })

  it('calculates correct dimensions at DEFAULT_SCALE', () => {
    const scaledWidth = BASE_CLOCK_WIDTH * DEFAULT_SCALE
    const scaledHeight = BASE_CLOCK_HEIGHT * DEFAULT_SCALE
    expect(scaledWidth).toBe(252)
    expect(scaledHeight).toBe(132)
  })

  it('calculates exact centered position and scale for Ctrl+T zen desk clock mode', () => {
    expect(CENTERED_SCALE).toBe(3.5)
    const pos = getCenteredPos(3.5)
    // Scaled width = 168 * 3.5 = 588. Window width = 1536. (1536 - 588) / 2 = 474
    expect(pos.x).toBeCloseTo(474, 1)
    // Scaled height = 88 * 3.5 = 308. Window height = 825. (825 - 308) / 2 = 258.5
    expect(pos.y).toBeCloseTo(258.5, 1)
  })

  it('verifies core React hooks are explicitly imported in FlipClock.jsx', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const clockPath = path.resolve(__dirname, '../FlipClock.jsx')
    const content = fs.readFileSync(clockPath, 'utf8')
    const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]react['"]/)
    expect(importMatch).toBeTruthy()
    const importedHooks = importMatch[1].split(',').map((s) => s.trim())
    // useMemo isn't asserted here — the component has no expensive per-render
    // computation worth memoizing (positions/scale are cheap arithmetic), so
    // it was an unused import (ESLint no-unused-vars) rather than a real hook.
    expect(importedHooks).toContain('useEffect')
    expect(importedHooks).toContain('useState')
    expect(importedHooks).toContain('useRef')
    expect(importedHooks).toContain('useCallback')
  })

  it('preserves clock visibility when timetable legends expand (safe space available in area C)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const clockPath = path.resolve(__dirname, '../FlipClock.jsx')
    const content = fs.readFileSync(clockPath, 'utf8')
    // blocksLegend is removed so clock never disappears when legends expand
    expect(content).not.toContain('blocksLegend')
    expect(content).toContain('Safe space is available in area (C)')
  })
})
