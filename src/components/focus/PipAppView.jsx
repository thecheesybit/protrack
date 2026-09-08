import { Play, Pause, Maximize2, X, Volume2, VolumeX } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { exitPip, closePip } from '@/lib/pip'

// The whole square is an Electron drag handle. Only elements that carry `no-drag`
// stay clickable — every interactive control below opts out explicitly. A
// transparent full-bleed overlay must NOT carry `no-drag`, or it kills dragging
// across the entire window.
const NO_DRAG = { WebkitAppRegion: 'no-drag' }

function mmss(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * A progress ring that fills whatever box it's given (viewBox-scaled), so the
 * PiP view looks right whether the OS window is 240px or, mid-resize, still
 * full-screen.
 */
function FluidRing({ progress, color, children }) {
  const R = 46
  const c = 2 * Math.PI * R
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 4px ${color}77)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/**
 * Desktop floating Picture-in-Picture view. The native window is morphed to a
 * small always-on-top square (electron/main.js `pip:enter`) — this fills it and
 * stays legible at any size.
 *
 * Interaction:
 *  - The whole square drags the OS window (grab anywhere on the ring / body).
 *  - Double-click the digits → expand back to the full window.
 *  - The slim bottom bar always shows mm:ss + a pause/resume button (no hover).
 *  - Hover reveals: mute (top-left), expand + close (top-right), and a big
 *    play/pause above the status bar.
 *
 * The countdown and scene audio never reset here.
 */
export function PipAppView() {
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)
  const muted = useStore((s) => s.muted)
  const toggleMute = useStore((s) => s.toggleMute)
  const session = useStore((s) => s.session)

  const isBreak = phase === 'break'
  const accent = isBreak ? '#10b981' : session?.color || '#f59e0b'
  const total = phaseTotalSec || secondsLeft || 1
  const progress = 1 - secondsLeft / total
  const running = status === 'running'
  const toggleRun = () => (running ? pause() : resume())

  return (
    <div
      className="group relative flex h-screen w-screen select-none items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-[7%] font-sans text-white antialiased"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Ring fills the square. Draggable surface; digits double-click to expand */}
      <div className="relative aspect-square h-full max-h-full w-auto max-w-full">
        <FluidRing progress={progress} color={accent}>
          <div
            onDoubleClick={exitPip}
            title="Double-click to expand"
            className="flex cursor-pointer flex-col items-center px-2"
            style={NO_DRAG}
          >
            <span
              className="font-bold leading-none tabular-nums tracking-tight text-white drop-shadow-sm"
              style={{ fontSize: 'clamp(1.5rem, 18vmin, 2.75rem)' }}
            >
              {mmss(secondsLeft)}
            </span>
            <span
              className="mt-[3%] font-semibold uppercase tracking-[0.2em]"
              style={{ color: accent, fontSize: 'clamp(0.5rem, 4.5vmin, 0.72rem)' }}
            >
              {isBreak ? 'Break' : 'Focus'}
            </span>
          </div>
        </FluidRing>
      </div>

      {/* Hover controls — container has NO app-region so the body stays draggable;
          only the buttons opt out with `no-drag`. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-black/40 p-2 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
        <div className="flex items-start justify-between">
          <button
            type="button"
            onClick={toggleMute}
            style={NO_DRAG}
            className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border transition-all active:scale-95 ${
              muted
                ? 'border-rose-400/40 bg-rose-500/20 text-rose-300'
                : 'border-white/15 bg-white/10 text-white/85 hover:bg-white/20'
            }`}
            title={muted ? 'Unmute scene audio' : 'Mute scene audio'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={exitPip}
              style={NO_DRAG}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/85 transition-all hover:bg-white/20 active:scale-95"
              title="Expand — restore the window, keep the timer running"
              aria-label="Expand to full window"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={closePip}
              style={NO_DRAG}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/85 transition-all hover:bg-red-500 hover:text-white active:scale-95"
              title="Close — restore the window and pause the session"
              aria-label="Close and pause the session"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Big play / pause, kept clear of the digits */}
        <div className="flex justify-center pb-7">
          <button
            type="button"
            onClick={toggleRun}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ ...NO_DRAG, backgroundColor: accent, boxShadow: `0 0 16px ${accent}66` }}
            title={running ? 'Pause' : 'Resume'}
            aria-label={running ? 'Pause' : 'Resume'}
          >
            {running ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Always-visible status bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 px-2.5 pb-1.5">
        <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white/90 backdrop-blur-sm">
          {mmss(secondsLeft)}
        </span>
        <button
          type="button"
          onClick={toggleRun}
          style={NO_DRAG}
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 active:scale-95"
          title={running ? 'Pause' : 'Resume'}
          aria-label={running ? 'Pause' : 'Resume'}
        >
          {running ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-[1px]" />}
        </button>
      </div>
    </div>
  )
}
