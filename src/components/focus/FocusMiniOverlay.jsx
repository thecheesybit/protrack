import { AnimatePresence, motion } from 'framer-motion'
import { Play, Pause, PictureInPicture2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { enterPip } from '@/lib/pip'

function mmss(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function MiniRing({ progress, color }) {
  const size = 34
  const r = (size - 5) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  )
}

/**
 * Always-on miniature timer. Anchors globally whenever a focus/break session is
 * active AND the user has zoomed into a different module (so the full Focus
 * widget is off-screen) — tracking is never lost. Click to jump back to Focus.
 * Bottom-left so it never collides with the AI companion FAB (bottom-right).
 */
export function FocusMiniOverlay() {
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
  const session = useStore((s) => s.session)
  const maximizedWidgetId = useStore((s) => s.maximizedWidgetId)
  const focusContext = useStore((s) => s.focusContext)
  const maximizeWidget = useStore((s) => s.maximizeWidget)
  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)

  const active = status !== 'idle'
  const show = active && Boolean(maximizedWidgetId) && maximizedWidgetId !== 'focus' && !focusContext

  // Mirror the same total used by the Focus widget + lock screen so the mini
  // ring stays in lockstep (tracks custom timers and mid-session adjustments).
  const phaseTotal = phaseTotalSec || secondsLeft || 1
  const progress = 1 - secondsLeft / phaseTotal
  const color = phase === 'break' ? '#10b981' : 'rgb(var(--accent))'

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className="edge-light fixed bottom-6 left-6 z-30 flex items-center gap-2 rounded-2xl border border-line/70 bg-surface/80 py-2 pl-2 pr-2.5 shadow-glass-lg backdrop-blur-2xl"
        >
          <button
            type="button"
            onClick={() => maximizeWidget('focus')}
            className="flex items-center gap-2.5 text-left"
            title="Return to Deep Focus"
          >
            <MiniRing progress={progress} color={color} />
            <span className="leading-tight">
              <span className="block text-[10px] uppercase tracking-widest text-muted">
                {phase === 'break' ? 'Break' : 'Focus'}
              </span>
              <span className="block text-sm font-bold tabular-nums text-ink">{mmss(secondsLeft)}</span>
              {session?.label && (
                <span className="block max-w-[140px] truncate text-[10px] text-muted">{session.label}</span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => (status === 'running' ? pause() : resume())}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent transition-colors hover:bg-accent/25"
            aria-label={status === 'running' ? 'Pause' : 'Resume'}
          >
            {status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={enterPip}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-amber-400 transition-colors hover:bg-white/10 hover:text-amber-300"
            title="Picture-in-Picture mode"
            aria-label="Picture-in-Picture"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
