/**
 * Tests for the Picture-in-Picture enter/exit/close orchestrators.
 *
 * The store is mocked so we can assert exactly which actions fire and in what
 * order. `window.protrack.pip` is stubbed to stand in for the Electron IPC
 * bridge; the "no bridge" case covers a plain browser.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  pipActive: false,
  status: 'running',
  setPipActive: vi.fn(),
  pause: vi.fn(),
}))

vi.mock('@/store/useStore', () => ({
  useStore: { getState: () => mockState },
}))

import { enterPip, exitPip, closePip } from '../pip.js'

const originalWindow = globalThis.window

beforeEach(() => {
  mockState.pipActive = false
  mockState.status = 'running'
  mockState.setPipActive.mockReset()
  mockState.setPipActive.mockImplementation((v) => {
    mockState.pipActive = v
  })
  mockState.pause.mockReset()
  mockState.pause.mockImplementation(() => {
    mockState.status = 'paused'
  })
  globalThis.window = {
    protrack: {
      pip: {
        enter: vi.fn().mockResolvedValue(true),
        exit: vi.fn().mockResolvedValue(true),
      },
    },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  globalThis.window = originalWindow
  vi.restoreAllMocks()
})

describe('enterPip', () => {
  it('invokes the pip:enter IPC then flips pipActive on', async () => {
    await enterPip()
    expect(window.protrack.pip.enter).toHaveBeenCalledTimes(1)
    expect(mockState.setPipActive).toHaveBeenCalledWith(true)
    expect(mockState.pipActive).toBe(true)
  })

  it('still flips pipActive on in a browser with no IPC bridge', async () => {
    globalThis.window = {}
    await enterPip()
    expect(mockState.setPipActive).toHaveBeenCalledWith(true)
  })

  it('swallows an IPC failure and still flips the flag', async () => {
    window.protrack.pip.enter.mockRejectedValueOnce(new Error('boom'))
    await enterPip()
    expect(mockState.setPipActive).toHaveBeenCalledWith(true)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('exitPip', () => {
  it('invokes the pip:exit IPC then flips pipActive off, without pausing', async () => {
    mockState.pipActive = true
    await exitPip()
    expect(window.protrack.pip.exit).toHaveBeenCalledTimes(1)
    expect(mockState.setPipActive).toHaveBeenCalledWith(false)
    expect(mockState.pause).not.toHaveBeenCalled()
    expect(mockState.pipActive).toBe(false)
  })

  it('swallows an IPC failure and still flips the flag', async () => {
    window.protrack.pip.exit.mockRejectedValueOnce(new Error('boom'))
    await exitPip()
    expect(mockState.setPipActive).toHaveBeenCalledWith(false)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('closePip', () => {
  it('pauses the session and then exits PiP', async () => {
    mockState.pipActive = true
    await closePip()
    expect(mockState.pause).toHaveBeenCalledTimes(1)
    expect(window.protrack.pip.exit).toHaveBeenCalledTimes(1)
    expect(mockState.setPipActive).toHaveBeenCalledWith(false)
    expect(mockState.status).toBe('paused')
    expect(mockState.pipActive).toBe(false)
  })

  it('pauses before the exit IPC resolves (clock never ticks away unattended)', async () => {
    const calls = []
    mockState.pause.mockImplementation(() => calls.push('pause'))
    window.protrack.pip.exit.mockImplementation(() => {
      calls.push('exit')
      return Promise.resolve(true)
    })
    await closePip()
    expect(calls).toEqual(['pause', 'exit'])
  })

  it('still pauses in a browser with no IPC bridge', async () => {
    globalThis.window = {}
    await closePip()
    expect(mockState.pause).toHaveBeenCalledTimes(1)
    expect(mockState.setPipActive).toHaveBeenCalledWith(false)
  })
})
