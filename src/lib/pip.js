import { useStore } from '@/store/useStore'

/**
 * Enters Picture-in-Picture mode.
 * In desktop Electron: morphs the window to a floating 300x380 always-on-top mini-widget.
 * In web browser: sets pipActive for Document PiP or floating in-app box.
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
 * Exits Picture-in-Picture mode and restores the main application window.
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
