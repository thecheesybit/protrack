import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'

/**
 * Floating flip-card clock pinned to the left edge of the workspace. Each
 * digit (hour-tens, hour-ones, minute-tens, minute-ones) is its own card that
 * flips vertically when its value changes — same idea as the classic split-flap
 * train timetable boards. Auto-detects 12h vs 24h from the user's locale and
 * defaults to 12h with AM/PM since that's what was requested.
 *
 * Hidden during focus / fullscreen / when chrome is auto-hidden so it never
 * gets in the way of deep work.
 */

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
            // Subtle hairline across the middle — split-flap mechanical feel.
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
  const chromeHidden = useStore((s) => s.chromeHidden)
  const fullscreen = useStore((s) => s.fullscreen)
  const focusRunning = useStore((s) => s.status === 'running')

  useEffect(() => {
    // 1s tick is fine — only the digits that actually change re-render thanks
    // to React's keyed AnimatePresence.
    const id = setInterval(() => setT(formatNow()), 1000)
    return () => clearInterval(id)
  }, [])

  const hidden = chromeHidden || fullscreen || focusRunning

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          key="flip-clock"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          className="pointer-events-none fixed left-3 top-1/2 z-20 hidden -translate-y-1/2 select-none flex-col items-center gap-2 rounded-2xl border border-line/50 bg-surface/40 px-3 py-3 shadow-glass backdrop-blur-xl xl:flex"
          aria-hidden
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
