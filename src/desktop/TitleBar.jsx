import { useEffect, useState } from 'react'
import { Minus, Square, Copy, Maximize2, Minimize2, X } from 'lucide-react'
import { desktopBridge } from './isDesktop'
import { Logo } from '@/components/common/Logo'
import { useStore } from '@/store/useStore'

/**
 * Custom frameless title bar. The native window controls (minimize, maximize,
 * fullscreen, close) are ALWAYS visible — they are the OS window frame and must
 * never be swallowed by the in-app auto-hiding chrome. The center region is a
 * drag handle (-webkit-app-region: drag); buttons opt out via no-drag.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const fullscreen = useStore((s) => s.fullscreen)

  const ctrl = desktopBridge?.window

  useEffect(() => {
    ctrl?.isMaximized?.().then((v) => setMaximized(Boolean(v)))

    // Subscribe to live state events from main so buttons stay in sync when
    // the window state changes externally (global hotkey, OS double-click, etc.)
    const unsub = ctrl?.onStateChange?.((state) => {
      if (state.maximized !== undefined) setMaximized(state.maximized)
    })
    return () => unsub?.()
  }, [ctrl])

  const onMinimize = () => ctrl?.minimize()
  const onMaximize = async () => setMaximized(Boolean(await ctrl?.maximize()))
  const onFullscreen = async () => ctrl?.toggleFullScreen()
  const onClose = () => ctrl?.close()

  if (fullscreen) return null

  return (
    <div className="shrink-0">
      <div
        className="flex h-9 items-center justify-end bg-transparent"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={onMinimize}
            className="flex w-11 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onFullscreen}
            className="flex w-11 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            title={fullscreen ? 'Exit full screen' : 'Full screen'}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onMaximize}
            className="flex w-11 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Maximize"
          >
            {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
          </button>
          <button
            onClick={onClose}
            className="flex w-11 items-center justify-center text-muted transition-colors hover:bg-red-500 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
