import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { desktopBridge } from '@/desktop/isDesktop'

/**
 * Global lifecycle hook managing application lock triggers:
 * - Cold startup: initial locked state if lock is enabled.
 * - Window minimize: locks workspace on Electron/OS minimize or tab hide.
 * - Window close/hide: locks workspace when window is hidden to tray/background.
 */
export function useAppLock() {
  const lockConfig = useStore((s) => s.lockConfig)
  const lockApp = useStore((s) => s.lockApp)
  const refreshLockConfig = useStore((s) => s.refreshLockConfig)

  // 1. Refresh lock configuration on mount without locking
  useEffect(() => {
    refreshLockConfig()
  }, [refreshLockConfig])

  // 2. Desktop Electron window state events (minimize, hide)
  useEffect(() => {
    const ctrl = desktopBridge?.window
    if (!ctrl?.onStateChange) return

    const unsub = ctrl.onStateChange((state) => {
      if (!lockConfig?.enabled) return

      if (state.minimized && (lockConfig.lockOnMinimize ?? true)) {
        lockApp()
      } else if (state.hidden && (lockConfig.lockOnClose ?? true)) {
        lockApp()
      }
    })

    return () => unsub?.()
  }, [lockConfig, lockApp])

  // 3. Web & OS visibilitychange events (browser minimize, tab switch)
  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.hidden && lockConfig?.enabled) {
        if (lockConfig.lockOnMinimize ?? true) {
          lockApp()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [lockConfig, lockApp])

  // 4. Sync lock changes across tabs or windows
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (e) => {
      if (e.key === 'protrack:app_lock') {
        refreshLockConfig()
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [refreshLockConfig])
}
