import React, { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import toast from 'react-hot-toast'

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
        if (islandIdRef.current) {
          st().updateIsland(islandIdRef.current, {
            kind: 'update-ready',
            title: 'Update Ready to Install',
            detail: 'Click here to restart and apply.',
            progress: 100,
          })
        } else {
          islandIdRef.current = st().pushIsland({
            kind: 'update-ready',
            title: 'Update Ready to Install',
            detail: 'Click here to restart and apply.',
            sticky: true,
          })
        }
        
        // Show a 1-click toast notification for immediate background update
        toast((t) => 
          React.createElement('div', { className: 'flex items-center gap-3' },
            React.createElement('span', { className: 'text-xs font-semibold text-ink' }, 
              `Version ${p?.version || ''} ready`
            ),
            React.createElement('button', {
              onClick: () => {
                toast.dismiss(t.id)
                desktopBridge?.update?.install?.()
              },
              className: 'rounded-lg bg-accent px-2.5 py-1 text-[10px] font-bold text-white shadow-premium-sm'
            }, 'Restart')
          ), {
            duration: 15000,
            id: 'update-ready-toast',
          }
        )
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
