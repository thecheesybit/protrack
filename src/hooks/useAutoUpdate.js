import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'

/**
 * Bridges Electron autoUpdater events into the store and freezes the focus
 * engine the moment an update begins downloading. Desktop-only; a no-op on web.
 * Mounted once at the App root so the gate can cover every screen.
 */
export function useAutoUpdate() {
  useEffect(() => {
    const u = desktopBridge?.update
    if (!isDesktop || !u) return undefined

    const st = () => useStore.getState()
    const offs = [
      u.onChecking?.(() => st().reportUpdateChecking()),
      u.onAvailable((p) => {
        st().reportUpdateAvailable(p?.version)
        // Freeze background work — a running session is paused.
        if (st().status === 'running') st().pause()
      }),
      u.onNotAvailable?.(() => st().reportUpdateNotAvailable()),
      u.onProgress((p) => st().reportUpdateProgress(p?.percent || 0)),
      u.onDownloaded((p) => st().reportUpdateReady(p?.version)),
      u.onError((p) => st().reportUpdateError(p?.message)),
    ]
    return () => offs.forEach((off) => typeof off === 'function' && off())
  }, [])
}
