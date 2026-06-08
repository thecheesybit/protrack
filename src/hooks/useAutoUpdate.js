import React, { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import toast from 'react-hot-toast'

/**
 * Bridges Electron autoUpdater events into the store and pushes interactive,
 * non-blocking notifications to the Dynamic Island.
 */
export function useAutoUpdate() {
  const islandIdRef = useRef(null)

  useEffect(() => {
    const u = desktopBridge?.update
    if (!isDesktop || !u) return undefined

    const st = () => useStore.getState()
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
      }),
      u.onNotAvailable?.(() => st().reportUpdateNotAvailable()),
      u.onProgress((p) => {
        const pct = p?.percent || 0
        st().reportUpdateProgress(pct)
        if (islandIdRef.current) {
          st().updateIsland(islandIdRef.current, { progress: pct })
        }
      }),
      u.onDownloaded((p) => {
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
        st().reportUpdateError(p?.message)
        if (islandIdRef.current) {
          st().dismissIsland(islandIdRef.current)
          islandIdRef.current = null
        }
        st().pushIsland({
          kind: 'info',
          title: 'Update failed',
          detail: p?.message || 'Check connection.',
          duration: 4000,
        })
      }),
    ]
    return () => offs.forEach((off) => typeof off === 'function' && off())
  }, [])
}
