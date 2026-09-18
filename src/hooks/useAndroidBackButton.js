import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { isAndroid } from '@/desktop/isDesktop'

/**
 * Android hardware / gesture "back" handling.
 *
 * The desktop build maps Escape to a "close the topmost surface" ladder (see the
 * global keydown handler in Dashboard.jsx). Android has no Escape key — the
 * system back gesture is the equivalent — so this hook wires the Capacitor
 * `@capacitor/app` backButton event to the same ladder, then falls back to a
 * double-tap-to-exit guard so a stray back never drops the user out of the app.
 *
 * Android-only: on desktop/web `isAndroid` is false and the effect is a no-op,
 * so `@capacitor/app` is never even imported there.
 */

function dispatchEscape() {
  try {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  } catch {
    /* very old WebView without the KeyboardEvent constructor — ignore */
  }
}

export function useAndroidBackButton() {
  const lastBackRef = useRef(0)

  useEffect(() => {
    if (!isAndroid) return undefined

    let cancelled = false
    let remove = () => {}

    ;(async () => {
      try {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('backButton', () => {
          const st = useStore.getState()

          // Focus lock, center-blur prompts and the Zen overlay each own their
          // own Escape handling (quit confirmation / snooze / dismiss). Defer to
          // it so back behaves exactly like Escape does on desktop for these.
          if (st.focusLocked || st.activePrompt) {
            dispatchEscape()
            return
          }

          // Close the topmost open surface — same order as the desktop ladder.
          if (st.helpOpen) return void st.setHelpOpen(false)
          if (st.weatherPlaygroundOpen) return void st.setWeatherPlaygroundOpen(false)
          if (st.alarmModalOpen) return void st.setAlarmModalOpen(false)
          if (st.clockCentered) return void st.setClockCentered(false)
          if (st.focusContext) return void st.closeFocus()
          if (st.whatsNewOpen) return void st.setWhatsNewOpen(false)
          if (st.aiOpen) return void st.setAiOpen(false)
          if (st.settingsOpen) return void st.setSettingsOpen(false)
          if (st.supportOpen) return void st.setSupportOpen(false)
          if (st.scopeDropdownOpen) return void st.setScopeDropdownOpen(false)
          if (st.handsFreeActive) return void st.setHandsFreeActive(false)
          if (st.maximizedWidgetId) return void st.restoreWidgets()

          // Clean dashboard: require a second back within 2s before exiting.
          const now = Date.now()
          if (now - lastBackRef.current < 2000) {
            App.exitApp()
          } else {
            lastBackRef.current = now
            toast('Press back again to exit', { duration: 2000 })
          }
        })

        if (cancelled) handle.remove()
        else remove = () => handle.remove()
      } catch (err) {
        console.warn('[android] back-button listener failed', err)
      }
    })()

    return () => {
      cancelled = true
      remove()
    }
  }, [])
}
