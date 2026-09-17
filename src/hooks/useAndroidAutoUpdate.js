import { useEffect, useRef } from 'react'
import { isAndroid } from '@/desktop/isDesktop'
import { checkForAndroidUpdate, installAndroidUpdate } from '@/services/androidUpdateService'
import { useStore } from '@/store/useStore'

/**
 * Android companion equivalent of useAutoUpdate.
 * Quietly checks GitHub releases on launch and surfaces available APK updates
 * via the Dynamic Island and the store.
 */
export function useAndroidAutoUpdate() {
  const checkedRef = useRef(false)

  useEffect(() => {
    if (!isAndroid || checkedRef.current) return
    checkedRef.current = true

    const runCheck = async () => {
      const st = useStore.getState()
      st.reportUpdateChecking?.()

      const res = await checkForAndroidUpdate()
      if (res.available) {
        st.reportUpdateAvailable?.(res.latestVersion)

        // Surface gentle, non-blocking notification on Dynamic Island
        st.pushIsland?.({
          kind: 'info',
          title: `Update v${res.latestVersion} Available`,
          detail: 'Tap here or visit Settings → Updates to install.',
          duration: 9000,
          action: () => {
            installAndroidUpdate(res.downloadUrl).catch((e) => {
              console.warn('[android-update] install failed:', e)
            })
          },
        })
      } else {
        st.reportUpdateNotAvailable?.()
      }
    }

    // Delay check slightly after boot to prioritize initial UI render
    const timer = setTimeout(runCheck, 3500)
    return () => clearTimeout(timer)
  }, [])
}
