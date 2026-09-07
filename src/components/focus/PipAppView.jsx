import React from 'react'
import { Play, Pause, Plus, Minus, Maximize2, X, TreePine } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { exitPip } from '@/lib/pip'

function mmss(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function MiniRing({ progress, color = '#f59e0b', size = 138, children }) {
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
 * Dedicated renderer view for the desktop Picture-in-Picture floating window.
 * Rendered when running in Electron with pipActive = true.
 */
export function PipAppView() {
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
  const total = phaseTotalSec || secondsLeft || 1
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / total))

  return (
    <div className="flex h-full w-full select-none flex-col justify-between bg-slate-950 p-4 font-sans text-white antialiased border border-white/10 rounded-2xl shadow-2xl">
      {/* ── Drag Header Bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between border-b border-white/10 pb-2.5 cursor-move"
        style={{ WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <span
            className="h-2.5 w-2.5 rounded-full animate-pulse shadow-sm"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
            {isBreak ? 'Break' : 'Deep Focus'}
          </span>
        </div>

        <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            type="button"
            onClick={exitPip}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all active:scale-95"
            title="Expand to full screen"
            aria-label="Expand"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={exitPip}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 hover:bg-red-500 hover:text-white transition-all active:scale-95"
            title="Return to app"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Circular Progress Ring ──────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center py-1">
        <MiniRing progress={progress} color={accentColor} size={140}>
          <span className="text-3xl font-bold tabular-nums tracking-tight text-white drop-shadow-sm">
            {mmss(secondsLeft)}
          </span>
          {session?.label && (
            <span className="max-w-[120px] truncate text-[11px] font-medium text-white/70 mt-0.5 text-center px-1">
              {session.label}
            </span>
          )}
        </MiniRing>
      </div>

      {/* ── Timer Controls & Tree Status ────────────────────────────── */}
      <div className="flex flex-col gap-2.5" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => adjustSeconds(-60)}
            className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all"
            title="Subtract 1 minute"
          >
            <Minus className="h-3 w-3" /> 1m
          </button>

          <button
            type="button"
            onClick={() => (status === 'running' ? pause() : resume())}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: accentColor, boxShadow: `0 0 16px ${accentColor}55` }}
            title={status === 'running' ? 'Pause' : 'Resume'}
          >
            {status === 'running' ? (
              <Pause className="h-4.5 w-4.5 fill-current" />
            ) : (
              <Play className="h-4.5 w-4.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => adjustSeconds(60)}
            className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all"
            title="Add 1 minute"
          >
            <Plus className="h-3 w-3" /> 1m
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[10px] text-emerald-400 font-medium">
          <TreePine className="h-3.5 w-3.5" />
          <span>Growing a tree for your focus stats</span>
        </div>
      </div>
    </div>
  )
}
