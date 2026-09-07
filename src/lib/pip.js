import { useStore } from '@/store/useStore'

/**
 * Enters Picture-in-Picture mode.
 * In desktop Electron: morphs the single window down to a small always-on-top
 * square (see electron/main.js `pip:enter`) that renders <PipAppView/>.
 * In a browser: just flips `pipActive` so <PipFocusWindow/> can open a real
 * Document Picture-in-Picture window.
 * The focus timer and scene audio keep running across the transition.
 */
export async function enterPip() {
  const { setPipActive } = useStore.getState()
  if (typeof window !== 'undefined' && window.protrack?.pip?.enter) {
    try {
      await window.protrack.pip.enter()
    } catch (err) {
      console.error('[pip] error invoking pip:enter', err)
    }
  }
  setPipActive(true)
}

/**
 * Leaves Picture-in-Picture and restores the main window to its exact prior
 * geometry / maximized / fullscreen state (handled in `pip:exit`). The session
 * keeps running — this is the "Expand" affordance. Never resets the timer.
 */
export async function exitPip() {
  const { setPipActive } = useStore.getState()
  if (typeof window !== 'undefined' && window.protrack?.pip?.exit) {
    try {
      await window.protrack.pip.exit()
    } catch (err) {
      console.error('[pip] error invoking pip:exit', err)
    }
  }
  setPipActive(false)
}

/**
 * Leaves Picture-in-Picture AND pauses the session — the "Close" affordance in
 * the mini widget. Distinct from `exitPip` (Expand), which leaves the clock
 * running. The window still restores to its prior state; only the timer stops.
 */
export async function closePip() {
  useStore.getState().pause()
  await exitPip()
}
