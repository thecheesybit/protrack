import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'

// No progress event for this long while downloading = stalled. electron-updater
// resumes interrupted downloads differentially, so a quiet re-check recovers it.
const STALL_MS = 3 * 60 * 1000
const STALL_RETRY_MS = 30 * 1000

/**
 * Bridges Electron autoUpdater events into the store and pushes interactive,
 * non-blocking notifications to the Dynamic Island. Owns the failure UX too:
 * a stall watchdog re-arms on every progress tick, and download errors fall
 * through to the slice (status 'error') so Settings offers a manual re-check.
 */
export function useAutoUpdate() {
  const islandIdRef = useRef(null)
  const stallTimerRef = useRef(null)
  const retryTimerRef = useRef(null)

  useEffect(() => {
    const u = desktopBridge?.update
    if (!isDesktop || !u) return undefined

    const st = () => useStore.getState()

    const disarmStallWatchdog = () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
    const armStallWatchdog = () => {
      disarmStallWatchdog()
      stallTimerRef.current = setTimeout(() => {
        if (st().updateStatus !== 'downloading') return
        st().reportUpdateError('Download stalled.')
        if (islandIdRef.current) {
          st().dismissIsland(islandIdRef.current)
          islandIdRef.current = null
        }
        st().pushIsland({
          kind: 'info',
          title: 'Update download stalled',
          detail: 'Retrying automatically in a moment.',
          duration: 5000,
        })
        retryTimerRef.current = setTimeout(() => u.check?.(), STALL_RETRY_MS)
      }, STALL_MS)
    }

    const offs = [
      u.onChecking?.(() => st().reportUpdateChecking()),
      u.onAvailable((p) => {
        st().reportUpdateAvailable(p?.version)
        // Freeze background work — a running focus session is paused.
        if (st().status === 'running') st().pause()

        // Push downloading status to the Dynamic Island
        if (islandIdRef.current) {
          st().dismissIsland(islandIdRef.current)
        }
        islandIdRef.current = st().pushIsland({
          kind: 'update-downloading',
          title: 'Downloading Update',
          detail: p?.version ? `Version ${p.version}` : 'New version available',
          progress: 0,
          sticky: true,
        })
        armStallWatchdog()
      }),
      u.onNotAvailable?.(() => st().reportUpdateNotAvailable()),
      u.onProgress((p) => {
        const pct = p?.percent || 0
        st().reportUpdateProgress(pct)
        if (islandIdRef.current) {
          st().updateIsland(islandIdRef.current, { progress: pct })
        }
        armStallWatchdog()
      }),
      u.onDownloaded((p) => {
        disarmStallWatchdog()
        st().reportUpdateReady(p?.version)
        // The update is already applied silently on the next quit
        // (autoInstallOnAppQuit). This is the single, non-blocking "apply now"
        // affordance: one sticky Island card whose tap calls update:install →
        // a silent quitAndInstall that relaunches into the new version.
        const detail = p?.version
          ? `Version ${p.version} — restart to apply`
          : 'Restart to apply update'
        if (islandIdRef.current) {
          st().updateIsland(islandIdRef.current, {
            kind: 'update-ready',
            title: 'Update ready',
            detail,
            progress: 100,
          })
        } else {
          islandIdRef.current = st().pushIsland({
            kind: 'update-ready',
            title: 'Update ready',
            detail,
            sticky: true,
          })
        }
      }),
      u.onError((p) => {
        disarmStallWatchdog()
        const wasReady = st().updateStatus === 'ready'
        st().reportUpdateError(p?.message)
        if (islandIdRef.current) {
          st().dismissIsland(islandIdRef.current)
          islandIdRef.current = null
        }
        // A late error after the update is fully downloaded changes nothing
        // for the user — keep quiet and keep the install affordance.
        if (!wasReady) {
          st().pushIsland({
            kind: 'info',
            title: 'Update failed',
            detail: p?.message || 'Check connection — you can retry from Settings.',
            duration: 4500,
          })
        }
      }),
    ]
    return () => {
      offs.forEach((off) => typeof off === 'function' && off())
      disarmStallWatchdog()
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])
}
