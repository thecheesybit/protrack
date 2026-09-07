import { Play, Pause, Maximize2, X, Volume2, VolumeX } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { exitPip, closePip } from '@/lib/pip'

// Electron drag regions swallow DOM clicks/dblclicks — any interactive target
// (and the double-click-to-restore zone) must opt out with `no-drag`.
const NO_DRAG = { WebkitAppRegion: 'no-drag' }

function mmss(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function MiniRing({ progress, color = '#f59e0b', size = 150, children }) {
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
          style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 6px ${color}77)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/**
 * Desktop floating Picture-in-Picture view. The native window is morphed to a
 * small always-on-top square (see electron/main.js `pip:enter`); this fills it.
 *
 * Interaction model:
 *  - The whole square is a drag handle that moves the OS window.
 *  - The timer digits are a NON-drag zone: DOUBLE-CLICK them to expand back to
 *    the full window (drag regions eat dblclick, so the restore target has to
 *    be a `no-drag` element).
 *  - A slim bar pinned to the bottom always shows mm:ss + a pause/resume dot —
 *    no hover required.
 *  - Hovering reveals the full controls: mute, Expand (keep the clock running),
 *    Close (restore + pause), and a large play/pause.
 *
 * The countdown and scene audio never reset here — the tick lives in
 * useFocusEngine and BackgroundAudioPlayer keeps playing through the morph.
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
  // phaseTotalSec is the single source of truth for ring progress.
  const total = phaseTotalSec || secondsLeft || 1
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / total))
  const running = status === 'running'
  const toggleRun = () => (running ? pause() : resume())

  return (
    <div
      className="group relative flex h-screen w-screen select-none items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 font-sans text-white antialiased"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Timer — the only thing shown at rest */}
      <MiniRing progress={progress} color={accent} size={150}>
        <div
          onDoubleClick={exitPip}
          title="Double-click to expand"
          className="flex cursor-pointer flex-col items-center rounded-xl px-3 py-1"
          style={NO_DRAG}
        >
          <span className="text-[2.4rem] font-bold leading-none tabular-nums tracking-tight text-white drop-shadow-sm">
            {mmss(secondsLeft)}
          </span>
          <span
            className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: accent }}
          >
            {isBreak ? 'Break' : 'Focus'}
          </span>
        </div>
      </MiniRing>

      {/* Hover controls (video-PiP style) — hidden until the pointer is over */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-black/45 p-2 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100"
        style={NO_DRAG}
      >
        {/* Top row: mute (left) · expand + close (right) */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleMute}
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
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/85 transition-all hover:bg-white/20 active:scale-95"
              title="Expand — restore the window, keep the timer running"
              aria-label="Expand to full window"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={closePip}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/85 transition-all hover:bg-red-500 hover:text-white active:scale-95"
              title="Close — restore the window and pause the session"
              aria-label="Close and pause the session"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Center: play / pause */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={toggleRun}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: accent, boxShadow: `0 0 18px ${accent}66` }}
            title={running ? 'Pause' : 'Resume'}
            aria-label={running ? 'Pause' : 'Resume'}
          >
            {running ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </button>
        </div>

        {/* Bottom spacer keeps the play button vertically centered */}
        <div className="h-7" />
      </div>

      {/* Always-visible status bar: mm:ss + pause/resume, no hover needed */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 px-2.5 pb-1.5">
        <span className="rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white/90 backdrop-blur-sm">
          {mmss(secondsLeft)}
        </span>
        <button
          type="button"
          onClick={toggleRun}
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-black/45 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/70 active:scale-95"
          style={NO_DRAG}
          title={running ? 'Pause' : 'Resume'}
          aria-label={running ? 'Pause' : 'Resume'}
        >
          {running ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current ml-[1px]" />}
        </button>
      </div>
    </div>
  )
}
