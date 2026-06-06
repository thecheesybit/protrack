import { useEffect, useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'

/**
 * Floating flip-card clock — draggable, visible on ALL screen sizes.
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
 * Dragging: Pointer-event-based drag. Position persisted to localStorage.
 * Double-click toggles pinned/auto mode.
 */

const SCALE_KEY = 'protrack:clock_scale'

function readInitialMode() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)
    return v === 'auto' ? 'auto' : 'pinned'
  } catch {
    return 'pinned'
  }
}

function readInitialPos() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(POS_KEY)
    if (v) {
      const parsed = JSON.parse(v)
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return parsed
    }
  } catch { /* fallback */ }
  return { x: 12, y: 12 }
}

function readInitialScale() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(SCALE_KEY)
    if (v) return parseFloat(v)
  } catch { /* fallback */ }
  return 1
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
  const [pos, setPos] = useState(readInitialPos)
  const [scale, setScale] = useState(readInitialScale)
  const chromeHidden = useStore((s) => s.chromeHidden)
  const fullscreen = useStore((s) => s.fullscreen)
  const focusRunning = useStore((s) => s.status === 'running')
  const focusLocked = useStore((s) => s.focusLocked)

  // Drag state refs (not in state to avoid re-renders during drag)
  const dragging = useRef(false)
  const dragStart = useRef({ px: 0, py: 0, ox: 0, oy: 0 })
  const clockRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setT(formatNow()), 1000)
    return () => clearInterval(id)
  }, [])

  // Prevent default scroll when hovering over clock to allow scale without scrolling page
  useEffect(() => {
    const el = clockRef.current
    if (!el) return
    const onWheel = (e) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handlePointerDown = useCallback((e) => {
    // Only primary button
    if (e.button !== 0) return
    dragging.current = false
    dragStart.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y }
    const el = clockRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [pos])

  const handlePointerMove = useCallback((e) => {
    const ds = dragStart.current
    const dx = e.clientX - ds.px
    const dy = e.clientY - ds.py
    // Only start dragging after 4px movement (prevents conflict with double-click)
    if (!dragging.current && Math.abs(dx) + Math.abs(dy) < 4) return
    dragging.current = true

    // Give a bit more wiggle room for edges if scaled
    const newX = Math.max(0, Math.min(window.innerWidth - (80 * scale), ds.ox + dx))
    const newY = Math.max(0, Math.min(window.innerHeight - (80 * scale), ds.oy + dy))
    setPos({ x: newX, y: newY })
  }, [scale])

  const handlePointerUp = useCallback(() => {
    if (dragging.current) {
      // Persist position
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos))
      } catch { /* private mode */ }
    }
    dragging.current = false
  }, [pos])

  const toggleMode = useCallback(() => {
    // Don't toggle if we were dragging
    if (dragging.current) return
    setMode((prev) => {
      const next = prev === 'pinned' ? 'auto' : 'pinned'
      try {
        localStorage.setItem(MODE_KEY, next)
      } catch { /* private mode */ }
      toast.success(
        next === 'pinned'
          ? 'Clock pinned — always visible'
          : 'Clock auto-hides during focus / fullscreen',
      )
      return next
    })
  }, [])

  const handleWheel = useCallback((e) => {
    setScale((prev) => {
      // deltaY positive means scrolling down, which we'll map to shrinking
      const ds = e.deltaY > 0 ? -0.1 : 0.1
      const next = Math.max(0.5, Math.min(3.0, prev + ds))
      try { localStorage.setItem(SCALE_KEY, next.toString()) } catch {}
      return Number(next.toFixed(1))
    })
  }, [])

  // During focus lock, always show if pinned
  const hiddenByAuto = mode === 'auto' && !focusLocked && (chromeHidden || fullscreen || focusRunning)

  return (
    <AnimatePresence>
      {!hiddenByAuto && (
        <motion.div
          ref={clockRef}
          key="flip-clock"
          initial={{ opacity: 0, scale: 0.9 * scale }}
          animate={{ opacity: 1, scale }}
          exit={{ opacity: 0, scale: 0.9 * scale }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          onDoubleClick={toggleMode}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          title={
            mode === 'pinned'
              ? 'Double-click to enable auto-hide · Drag to move · Scroll to resize'
              : 'Double-click to pin clock · Drag to move · Scroll to resize'
          }
          className="fixed z-[55] flex cursor-grab select-none flex-col items-center gap-2 rounded-2xl border border-line/50 bg-surface/40 px-3 py-3 shadow-glass backdrop-blur-xl transition-colors hover:border-accent/40 active:cursor-grabbing touch-none"
          style={{
            left: pos.x,
            top: pos.y,
            transformOrigin: 'top left', // Scale from the top left corner
          }}
          aria-label={`Flip clock — ${mode} mode (double-click to toggle, drag to move, scroll to scale)`}
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
