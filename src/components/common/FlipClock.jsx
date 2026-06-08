import { useEffect, useState, useRef, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { GripHorizontal } from 'lucide-react'
import { useStore } from '@/store/useStore'

/**
 * Floating flip-card clock — draggable, resizable, visible on ALL screen sizes.
 *
 * Interactions:
 *  - Drag body (primary mouse button) → move
 *  - Drag bottom-right grip handle → resize (scale)
 *  - Scroll wheel over clock → resize (scale)
 *  - Double-click body → toggle pin / auto-hide mode
 *
 * Visibility modes:
 *  - `pinned` (default) — always visible
 *  - `auto`             — hides during focus / fullscreen / chrome-hidden
 *
 * All state persisted to localStorage.
 */

const POS_KEY   = 'protrack:clock_pos'
const MODE_KEY  = 'protrack:clock_mode'
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
  const defaultY = typeof window !== 'undefined' ? window.innerHeight - 120 : 690
  return { x: 12, y: defaultY }
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
    <div
      className="relative h-10 w-7 overflow-hidden rounded-md border border-line/60 bg-surface-2/80 shadow-sm"
      style={{ perspective: '180px' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ rotateX: -90 }}
          animate={{ rotateX: 0 }}
          exit={{ rotateX: 90 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
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

  // Separate refs for body drag vs grip resize — both use pointer capture
  const dragging   = useRef(false)
  const dragStart  = useRef({ px: 0, py: 0, ox: 0, oy: 0, pressed: false })
  const resizing   = useRef(false)
  const resizeStart = useRef({ py: 0, os: 1, pressed: false })
  const clockRef   = useRef(null)
  const gripRef    = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setT(formatNow()), 1000)
    return () => clearInterval(id)
  }, [])

  // Prevent scroll-wheel from propagating to page (for scale-on-wheel)
  useEffect(() => {
    const el = clockRef.current
    if (!el) return
    const onWheel = (e) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* ── Body drag (move) ──────────────────────────────── */

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return
    // Don't start a body drag if the grip is initiating a resize
    if (resizing.current) return
    dragging.current = false
    dragStart.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y, pressed: true }
    const el = clockRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [pos])

  const handlePointerMove = useCallback((e) => {
    const ds = dragStart.current
    if (!ds.pressed) return
    const dx = e.clientX - ds.px
    const dy = e.clientY - ds.py
    // Only start dragging after 4px movement (prevents conflict with double-click)
    if (!dragging.current && Math.abs(dx) + Math.abs(dy) < 4) return
    dragging.current = true

    const newX = Math.max(0, Math.min(window.innerWidth  - 80 * scale, ds.ox + dx))
    const newY = Math.max(0, Math.min(window.innerHeight - 80 * scale, ds.oy + dy))
    setPos({ x: newX, y: newY })
  }, [scale])

  const handlePointerUp = useCallback(() => {
    dragStart.current.pressed = false
    if (dragging.current) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* private mode */ }
    }
    dragging.current = false
  }, [pos])

  /* ── Grip resize (scale) ───────────────────────────── */

  const handleGripPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.stopPropagation() // prevent body drag from starting
    resizing.current = true
    resizeStart.current = { py: e.clientY, os: scale, pressed: true }
    const el = gripRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [scale])

  const handleGripPointerMove = useCallback((e) => {
    const rs = resizeStart.current
    if (!rs.pressed) return
    // Dragging up → larger, dragging down → smaller (intuitive)
    const dy = e.clientY - rs.py
    const next = Math.max(0.5, Math.min(3.0, rs.os - dy / 120))
    setScale(Number(next.toFixed(2)))
  }, [])

  const handleGripPointerUp = useCallback(() => {
    resizeStart.current.pressed = false
    resizing.current = false
    try { localStorage.setItem(SCALE_KEY, scale.toString()) } catch { /* private mode */ }
  }, [scale])

  /* ── Wheel resize (bonus) ──────────────────────────── */

  const handleWheel = useCallback((e) => {
    setScale((prev) => {
      const ds = e.deltaY > 0 ? -0.1 : 0.1
      const next = Math.max(0.5, Math.min(3.0, prev + ds))
      try { localStorage.setItem(SCALE_KEY, next.toString()) } catch {}
      return Number(next.toFixed(1))
    })
  }, [])

  /* ── Double-click: toggle pin / auto-hide ─────────── */

  const toggleMode = useCallback(() => {
    if (dragging.current) return // was a drag, not a dbl-click
    setMode((prev) => {
      const next = prev === 'pinned' ? 'auto' : 'pinned'
      try { localStorage.setItem(MODE_KEY, next) } catch { /* private mode */ }
      toast.success(
        next === 'pinned'
          ? 'Clock pinned — always visible'
          : 'Clock auto-hides during focus / fullscreen',
      )
      return next
    })
  }, [])

  /* ── Visibility ────────────────────────────────────── */

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
          transition={{
            opacity: { duration: 0.35, ease: [0.2, 0, 0, 1] },
            scale: { type: 'spring', stiffness: 480, damping: 38 },
          }}
          onDoubleClick={toggleMode}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          title={
            mode === 'pinned'
              ? 'Double-click to enable auto-hide · Drag to move · Drag grip or scroll to resize'
              : 'Double-click to pin clock · Drag to move · Drag grip or scroll to resize'
          }
          className="fixed z-[55] flex cursor-grab select-none flex-col items-center gap-2 rounded-2xl border border-line/50 bg-surface/40 px-3 py-3 shadow-glass backdrop-blur-xl transition-colors hover:border-accent/40 active:cursor-grabbing touch-none group"
          style={{
            left: pos.x,
            top: pos.y,
            transformOrigin: 'top left',
          }}
          aria-label={`Flip clock — ${mode} mode (double-click to toggle, drag to move, drag grip to resize)`}
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

          {/* Mode indicator dot */}
          <span
            className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
              mode === 'pinned' ? 'bg-accent' : 'bg-muted/50'
            }`}
            title={mode === 'pinned' ? 'Pinned' : 'Auto-hide'}
          />

          {/* Bottom-right resize grip — visible on hover */}
          <div
            ref={gripRef}
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onPointerCancel={handleGripPointerUp}
            onDoubleClick={(e) => e.stopPropagation()} // don't toggle mode from grip
            title="Drag to resize"
            className="absolute -bottom-2 -right-2 flex h-5 w-5 cursor-nwse-resize items-center justify-center rounded-full border border-line bg-surface-2 text-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-ink hover:border-accent"
          >
            <GripHorizontal className="h-2.5 w-2.5 rotate-45" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
