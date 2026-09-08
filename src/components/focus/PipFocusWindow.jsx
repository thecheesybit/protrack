import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Pause, Plus, Minus, Maximize2, X, TreePine } from 'lucide-react'
import { useStore } from '@/store/useStore'

function mmss(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function MiniRing({ progress, color = '#f59e0b', size = 130, children }) {
  const stroke = 6
  const r = (size - stroke * 2) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

function PipContent({ onClose, onExpand }) {
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
  const session = useStore((s) => s.session)
  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)
  const adjustSeconds = useStore((s) => s.adjustSeconds)

  const isBreak = phase === 'break'
  const accentColor = isBreak ? '#10b981' : session?.color || '#f59e0b'
  // phaseTotalSec is the single source of truth for ring progress.
  const total = phaseTotalSec || secondsLeft || 1
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / total))

  return (
    <div className="flex h-screen w-screen select-none flex-col justify-between bg-slate-950 p-4 font-sans text-white antialiased">
      {/* Top action bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
            {isBreak ? 'Break' : 'Deep Focus'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExpand}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            title="Expand back into the app"
            aria-label="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            title="Close picture-in-picture"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="flex flex-col items-center justify-center py-2">
        <MiniRing progress={progress} color={accentColor} size={136}>
          <span className="text-3xl font-bold tabular-nums tracking-tight text-white">
            {mmss(secondsLeft)}
          </span>
          {session?.label && (
            <span className="max-w-[100px] truncate text-[10px] font-medium text-white/60">
              {session.label}
            </span>
          )}
        </MiniRing>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2">
        {/* Quick adjustments */}
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => adjustSeconds(-60)}
            className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/75 hover:bg-white/15 hover:text-white"
          >
            <Minus className="h-2.5 w-2.5" /> 1m
          </button>
          <button
            type="button"
            onClick={() => (status === 'running' ? pause() : resume())}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: accentColor }}
            title={status === 'running' ? 'Pause' : 'Resume'}
          >
            {status === 'running' ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => adjustSeconds(60)}
            className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/75 hover:bg-white/15 hover:text-white"
          >
            <Plus className="h-2.5 w-2.5" /> 1m
          </button>
        </div>

        {/* Tree encouragement status */}
        <div className="flex items-center justify-center gap-1 pt-1 text-[10px] text-emerald-400/90 font-medium">
          <TreePine className="h-3 w-3" />
          <span>Growing a tree for calendar</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Browser-only Picture-in-Picture: opens a real Document Picture-in-Picture
 * window and portals <PipContent/> into it.
 *
 * The desktop build never uses this path — Electron morphs its single window
 * instead (src/lib/pip.js → electron/main.js `pip:enter`, rendered by
 * <PipAppView/>). The `isDesktop` guards below keep this inert there.
 */
export function PipFocusWindow() {
  const pipActive = useStore((s) => s.pipActive)
  const setPipActive = useStore((s) => s.setPipActive)
  const [pipContainer, setPipContainer] = useState(null)
  const pipWindowRef = useRef(null)

  const isDesktop = typeof window !== 'undefined' && Boolean(window.protrack?.isDesktop)

  useEffect(() => {
    if (isDesktop) return

    if (!pipActive) {
      if (pipWindowRef.current) {
        try {
          pipWindowRef.current.close()
        } catch { /* noop */ }
        pipWindowRef.current = null
        setPipContainer(null)
      }
      return
    }

    // If native documentPictureInPicture is supported
    if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
      async function openPip() {
        try {
          const pipWindow = await window.documentPictureInPicture.requestWindow({
            width: 320,
            height: 380,
          })
          pipWindowRef.current = pipWindow

          // Copy styles
          const allStyleSheets = [...document.styleSheets]
          allStyleSheets.forEach((styleSheet) => {
            try {
              const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('')
              const style = document.createElement('style')
              style.textContent = cssRules
              pipWindow.document.head.appendChild(style)
            } catch {
              if (styleSheet.href) {
                const link = document.createElement('link')
                link.rel = 'stylesheet'
                link.type = styleSheet.type
                link.media = styleSheet.media
                link.href = styleSheet.href
                pipWindow.document.head.appendChild(link)
              }
            }
          })

          pipWindow.document.title = 'ProTrack Focus'
          pipWindow.document.body.style.margin = '0'
          pipWindow.document.body.style.overflow = 'hidden'
          pipWindow.document.body.style.backgroundColor = '#020617'

          const container = pipWindow.document.createElement('div')
          container.id = 'pip-root'
          container.style.height = '100%'
          container.style.width = '100%'
          pipWindow.document.body.appendChild(container)
          setPipContainer(container)

          pipWindow.addEventListener('pagehide', () => {
            pipWindowRef.current = null
            setPipContainer(null)
            setPipActive(false)
          })
        } catch (err) {
          console.error('[pip] documentPictureInPicture error', err)
          // If native PiP fails or is declined, just clear the flag.
          setPipActive(false)
        }
      }
      openPip()
    }

    return () => {
      if (pipWindowRef.current) {
        try {
          pipWindowRef.current.close()
        } catch { /* noop */ }
        pipWindowRef.current = null
        setPipContainer(null)
      }
    }
  }, [pipActive, setPipActive, isDesktop])

  const handleExpand = () => {
    try {
      window.focus()
    } catch { /* noop */ }
    setPipActive(false)
  }

  const handleClose = () => {
    setPipActive(false)
  }

  if (isDesktop || !pipActive || !pipContainer) return null

  return createPortal(
    <PipContent onClose={handleClose} onExpand={handleExpand} />,
    pipContainer,
  )
}
