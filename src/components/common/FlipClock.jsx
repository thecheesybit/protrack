import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'

/**
 * Floating flip-card clock pinned to the TOP-LEFT corner of the workspace.
 * Each digit (hour-tens, hour-ones, minute-tens, minute-ones) is its own card
 * that flips vertically when its value changes — same idea as the classic
 * split-flap train timetable boards. 12-hour with AM/PM + date.
 *
 * Visibility modes:
 *  - `pinned` (default) — always visible. Survives focus / fullscreen /
 *    chrome-hidden.
 *  - `auto`           — hides during focus / fullscreen / chrome-hidden so
 *    the clock stays out of the way during deep work.
 *
 * Double-click the clock toggles between the two modes. The choice is
 * persisted to localStorage so it survives restarts.
 */

const MODE_KEY = 'protrack:clockMode'

function readInitialMode() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)
    return v === 'auto' ? 'auto' : 'pinned'
  } catch {
    return 'pinned'
  }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatNow() {
  const d = new Date()
  let h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return {
    h1: pad2(h)[0],
    h2: pad2(h)[1],
    m1: pad2(m)[0],
    m2: pad2(m)[1],
    period,
    dateLabel: d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
  }
}

function Digit({ value }) {
  return (
    <div className="relative h-10 w-7 overflow-hidden rounded-md border border-line/60 bg-surface-2/80 shadow-sm">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
          className="absolute inset-0 flex items-center justify-center font-mono text-xl font-semibold tabular-nums text-ink"
          style={{
            transformOrigin: 'center',
            backfaceVisibility: 'hidden',
            backgroundImage:
              'linear-gradient(to bottom, transparent 49%, rgb(var(--border) / 0.6) 49%, rgb(var(--border) / 0.6) 51%, transparent 51%)',
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

export function FlipClock() {
  const [t, setT] = useState(() => formatNow())
  const [mode, setMode] = useState(readInitialMode)
  const chromeHidden = useStore((s) => s.chromeHidden)
  const fullscreen = useStore((s) => s.fullscreen)
  const focusRunning = useStore((s) => s.status === 'running')

  useEffect(() => {
    const id = setInterval(() => setT(formatNow()), 1000)
    return () => clearInterval(id)
  }, [])

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'pinned' ? 'auto' : 'pinned'
      try {
        localStorage.setItem(MODE_KEY, next)
      } catch {
        /* private mode — in-memory update still applies */
      }
      toast.success(
        next === 'pinned'
          ? 'Clock pinned — always visible'
          : 'Clock auto-hides during focus / fullscreen',
      )
      return next
    })
  }

  // Auto mode tucks the clock away during deep work; pinned never hides.
  const hiddenByAuto = mode === 'auto' && (chromeHidden || fullscreen || focusRunning)

  return (
    <AnimatePresence>
      {!hiddenByAuto && (
        <motion.div
          key="flip-clock"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          onDoubleClick={toggleMode}
          title={
            mode === 'pinned'
              ? 'Double-click to enable auto-hide'
              : 'Double-click to pin clock (always visible)'
          }
          className="fixed left-3 top-3 z-20 hidden cursor-pointer select-none flex-col items-center gap-2 rounded-2xl border border-line/50 bg-surface/40 px-3 py-3 shadow-glass backdrop-blur-xl transition-colors hover:border-accent/40 xl:flex"
          aria-label={`Flip clock — ${mode} mode (double-click to toggle)`}
        >
          <div className="flex items-end gap-1">
            <Digit value={t.h1} />
            <Digit value={t.h2} />
            <span className="px-0.5 pb-1 text-xl font-bold text-muted">:</span>
            <Digit value={t.m1} />
            <Digit value={t.m2} />
          </div>
          <div className="flex w-full items-center justify-between gap-2 px-1">
            <span className="text-[10px] font-bold tracking-widest text-accent">
              {t.period}
            </span>
            <span className="text-[10px] text-muted">{t.dateLabel}</span>
          </div>
          {/* Visual hint for the mode — tiny dot in the corner */}
          <span
            className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
              mode === 'pinned' ? 'bg-accent' : 'bg-muted/50'
            }`}
            title={mode === 'pinned' ? 'Pinned' : 'Auto-hide'}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
