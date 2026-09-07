import { useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Plus, Minus, Maximize2, X, TreePine, Move } from 'lucide-react'
import { useStore } from '@/store/useStore'

function mmss(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function MiniRing({ progress, color = '#f59e0b', size = 110, children }) {
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

/**
 * Resizable, draggable in-app Picture-in-Picture floating widget.
 * Active when user triggers PIP in browsers where native Document PiP isn't active.
 */
export function FloatingFocusPip() {
  const pipActive = useStore((s) => s.pipActive)
  const setPipActive = useStore((s) => s.setPipActive)
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
  const session = useStore((s) => s.session)
  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)
  const adjustSeconds = useStore((s) => s.adjustSeconds)

  const pos = { x: 24, y: 80 }
  const [size, setSize] = useState({ w: 260, h: 320 })

  // In desktop Electron, native window morphing is handled by PipAppView
  const isDesktop = typeof window !== 'undefined' && Boolean(window.protrack?.isDesktop)
  const hasNativeDocPip = typeof window !== 'undefined' && 'documentPictureInPicture' in window
  if (!pipActive || hasNativeDocPip || isDesktop) return null

  const isBreak = phase === 'break'
  const accentColor = isBreak ? '#10b981' : session?.color || '#f59e0b'
  const total = phaseTotalSec || secondsLeft || 1
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / total))

  const handlePointerDownResize = (e) => {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const startW = size.w
    const startH = size.h

    const onPointerMove = (ev) => {
      const newW = Math.max(200, Math.min(480, startW + (ev.clientX - startX)))
      const newH = Math.max(240, Math.min(600, startH + (ev.clientY - startY)))
      setSize({ w: newW, h: newH })
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 flex flex-col justify-between rounded-2xl border border-white/20 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-2xl"
      style={{
        right: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
      }}
    >
      {/* Top drag bar */}
      <div className="flex cursor-move items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5">
          <Move className="h-3 w-3 text-muted" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
            {isBreak ? 'Break' : 'Deep Focus'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setPipActive(false)
              window.protrack?.window?.setFullScreen?.(true)
            }}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            title="Expand to Fullscreen"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setPipActive(false)}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            title="Close PIP"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Main Ring */}
      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <MiniRing progress={progress} color={accentColor} size={Math.min(size.w - 80, 120)}>
          <span className="text-2xl font-bold tabular-nums text-white">
            {mmss(secondsLeft)}
          </span>
          {session?.label && (
            <span className="max-w-[90px] truncate text-[9px] text-white/60">
              {session.label}
            </span>
          )}
        </MiniRing>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => adjustSeconds(-60)}
            className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-white/75 hover:bg-white/15"
          >
            <Minus className="h-2 w-2" /> 1m
          </button>
          <button
            type="button"
            onClick={() => (status === 'running' ? pause() : resume())}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: accentColor }}
          >
            {status === 'running' ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => adjustSeconds(60)}
            className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-white/75 hover:bg-white/15"
          >
            <Plus className="h-2 w-2" /> 1m
          </button>
        </div>

        <div className="flex items-center justify-center gap-1 text-[9px] text-emerald-400 font-medium">
          <TreePine className="h-2.5 w-2.5" />
          <span>Tree growing</span>
        </div>
      </div>

      {/* Resize handle (bottom right) */}
      <div
        onPointerDown={handlePointerDownResize}
        className="absolute bottom-1 right-1 h-4 w-4 cursor-se-resize opacity-40 hover:opacity-100 flex items-center justify-center"
        title="Resize"
      >
        <span className="h-1.5 w-1.5 border-r border-b border-white" />
      </div>
    </motion.div>
  )
}
