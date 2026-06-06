import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import { bindDevice } from '@/services/deviceService'

/**
 * Desktop-only integration mounted once in the Dashboard:
 *  - binds the hardware fingerprint to the account on first authenticated launch
 *  - wires the global pause/resume hotkey to the focus engine
 * A no-op on the web build.
 */
export function useDesktopIntegration() {
  const { user } = useAuth()

  // Hardware fingerprint binding (once per authenticated session).
  useEffect(() => {
    if (!isDesktop || !user || user.isAnonymous) return
    bindDevice(user.uid).catch((err) => console.error('[device] bind failed', err))
  }, [user])

  // Global hotkey → toggle the focus session.
  useEffect(() => {
    if (!isDesktop || !desktopBridge?.onFocusToggle) return undefined
    return desktopBridge.onFocusToggle(() => {
      const st = useStore.getState()
      if (st.status === 'idle') st.startFocus()
      else if (st.status === 'running') st.pause()
      else st.resume()
    })
  }, [])

  // Global hotkey → mute / unmute chime + ambient sound.
  useEffect(() => {
    if (!isDesktop || !desktopBridge?.onMute) return undefined
    return desktopBridge.onMute(() => {
      const st = useStore.getState()
      st.toggleMute()
      st.pushIsland({
        kind: 'info',
        title: !st.muted ? 'Sound muted' : 'Sound on',
        duration: 1800,
      })
    })
  }, [])

  // Listen to window state changes (like fullscreen)
  useEffect(() => {
    if (!isDesktop || !desktopBridge?.window) return undefined

    // Sync initial state
    desktopBridge.window.isFullScreen?.().then((v) => {
      useStore.getState().setFullscreen(Boolean(v))
    })

    return desktopBridge.window.onStateChange?.((state) => {
      if (state.fullscreen !== undefined) {
        useStore.getState().setFullscreen(state.fullscreen)
      }
    })
  }, [])
}
