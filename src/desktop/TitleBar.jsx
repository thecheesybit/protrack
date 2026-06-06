import { useState } from 'react'
import { Minus, Square, Copy, X } from 'lucide-react'
import { desktopBridge } from './isDesktop'
import { Logo } from '@/components/common/Logo'

/**
 * Custom frameless title bar. The center region is a drag handle
 * (-webkit-app-region: drag); buttons opt out via no-drag.
 */
export function TitleBar() {
  const [maximized, setMaximized] = useState(false)

  const ctrl = desktopBridge?.window
  const onMinimize = () => ctrl?.minimize()
  const onMaximize = async () => setMaximized(await ctrl?.maximize())
  const onClose = () => ctrl?.close()

  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between border-b border-line/60 bg-surface/70 backdrop-blur-xl"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2 pl-3">
        <Logo className="h-4 w-4" />
        <span className="text-xs font-semibold tracking-wide text-muted">PRO TRACK</span>
      </div>

      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={onMinimize}
          className="flex w-11 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5" />
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
  )
}
