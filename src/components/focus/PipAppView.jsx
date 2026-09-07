import { Play, Pause, Maximize2, X, Volume2, VolumeX } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { exitPip } from '@/lib/pip'

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
 * Minimal Picture-in-Picture view for the desktop floating window: nothing but
 * the timer ring by default. The whole square is a drag handle (moves the native
 * always-on-top window); play/pause, mute, expand and close fade in only on
 * hover, like a video PiP. Scene audio keeps playing via BackgroundAudioPlayer.
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
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / total))
  const running = status === 'running'

  return (
    <div
      className="group relative flex h-screen w-screen select-none items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-950 font-sans text-white antialiased"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Timer — the only thing shown at rest */}
      <MiniRing progress={progress} color={accent} size={150}>
        <span className="text-[2.6rem] font-bold leading-none tabular-nums tracking-tight text-white drop-shadow-sm">
          {mmss(secondsLeft)}
        </span>
        <span
          className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: accent }}
        >
          {isBreak ? 'Break' : 'Focus'}
        </span>
      </MiniRing>

      {/* Hover controls (video-PiP style) — hidden until the pointer is over */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-black/45 p-2 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100"
        style={{ WebkitAppRegion: 'no-drag' }}
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
              title="Expand — back to full screen"
              aria-label="Expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={exitPip}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/85 transition-all hover:bg-red-500 hover:text-white active:scale-95"
              title="Close PiP"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Center: play / pause */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => (running ? pause() : resume())}
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
    </div>
  )
}
