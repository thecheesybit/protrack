import { useEffect, useState, useRef, useCallback, memo } from 'react'
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

// Base clock dimensions before scaling:
// 4 digits (28px) + 4 gaps (4px) + colon (~14px) + container px-3 (24px) + border (2px) ≈ 168px
export const BASE_CLOCK_WIDTH  = 168
export const BASE_CLOCK_HEIGHT = 88

// Default scale of 1.25 gives ~210px width, matching the bottom row cards and screenshot proportions.
export const DEFAULT_SCALE = 1.25

export function getDefaultPos(currentScale = DEFAULT_SCALE) {
  const scaledHeight = BASE_CLOCK_HEIGHT * currentScale
  // Sit ~28px above the bottom of the window (clear of taskbar / screen edge)
  const defaultY = typeof window !== 'undefined'
    ? Math.max(0, window.innerHeight - scaledHeight - 28)
    : 680
  // Aligned with the sidebar icons rail (left-6 = 24px)
  const defaultX = 24
  return { x: defaultX, y: defaultY }
}

export function readInitialMode() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY)
    return v === 'auto' ? 'auto' : 'pinned'
  } catch {
    return 'pinned'
  }
}

export function readInitialPos(currentScale = DEFAULT_SCALE) {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(POS_KEY)
    if (v) {
      const parsed = JSON.parse(v)
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        // If x is 12 (the old hardcoded default before user custom positioning), migrate to new default
        if (parsed.x === 12) {
          return getDefaultPos(currentScale)
        }
        return parsed
      }
    }
  } catch { /* fallback */ }
  return getDefaultPos(currentScale)
}

export function readInitialScale() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(SCALE_KEY)
    if (v) {
      const parsed = parseFloat(v)
      if (!isNaN(parsed) && parsed > 0) {
        // If scale is 1 (the old hardcoded default before user custom scaling), migrate to new default
        if (parsed === 1) return DEFAULT_SCALE
        return parsed
      }
    }
  } catch { /* fallback */ }
  return DEFAULT_SCALE
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

const Digit = memo(function Digit({ value }) {
  return (
    <div
      className="relative h-11 w-8 overflow-hidden rounded-lg border border-line/70 bg-surface-2/90 shadow-sm"
      style={{ perspective: '200px' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ rotateX: -90 }}
          animate={{ rotateX: 0 }}
          exit={{ rotateX: 90 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 flex items-center justify-center font-sans text-2xl font-bold tabular-nums text-ink select-none"
          style={{
            transformOrigin: 'center',
            backfaceVisibility: 'hidden',
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
      {/* Subtle physical split-flap divider seam */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-[1px] -translate-y-1/2 bg-black/40 shadow-[0_1px_0_rgba(255,255,255,0.07)]" />
    </div>
  )
})

export function FlipClock() {
  const [t, setT] = useState(() => formatNow())
  const [mode, setMode] = useState(readInitialMode)
  const [scale, setScale] = useState(readInitialScale)
  const [pos, setPos] = useState(() => readInitialPos(readInitialScale()))
  const chromeHidden = useStore((s) => s.chromeHidden)
  const fullscreen = useStore((s) => s.fullscreen)
  const focusRunning = useStore((s) => s.status === 'running')
  const focusLocked = useStore((s) => s.focusLocked)

  // Keep refs in sync for handlers to prevent stale closure issues
  const posRef   = useRef(pos)
  const scaleRef = useRef(scale)
  posRef.current   = pos
  scaleRef.current = scale

  // Separate refs for body drag vs grip resize — both use pointer capture
  const dragging    = useRef(false)
  const dragStart   = useRef({ px: 0, py: 0, ox: 0, oy: 0, pressed: false })
  const resizing    = useRef(false)
  const resizeStart = useRef({ px: 0, py: 0, os: 1, pressed: false })
  const clockRef    = useRef(null)
  const gripRef     = useRef(null)

  useEffect(() => {
    const id = setInterval(() => {
      setT((prev) => {
        const next = formatNow()
        if (
          prev.h1 === next.h1 &&
          prev.h2 === next.h2 &&
          prev.m1 === next.m1 &&
          prev.m2 === next.m2 &&
          prev.period === next.period &&
          prev.dateLabel === next.dateLabel
        ) {
          return prev
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Responsive default docking: if user hasn't manually moved the clock,
  // keep it docked at bottom-left on window resize or maximize.
  useEffect(() => {
    let hasCustomPos = false
    try {
      const stored = localStorage.getItem(POS_KEY)
      hasCustomPos = Boolean(stored) && JSON.parse(stored)?.x !== 12
    } catch { /* fallback */ }
    if (hasCustomPos) return

    const onResize = () => {
      const nextPos = getDefaultPos(scaleRef.current)
      posRef.current = nextPos
      setPos(nextPos)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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
    dragStart.current = { px: e.clientX, py: e.clientY, ox: posRef.current.x, oy: posRef.current.y, pressed: true }
    const el = clockRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e) => {
    const ds = dragStart.current
    if (!ds.pressed) return
    const dx = e.clientX - ds.px
    const dy = e.clientY - ds.py
    // Only start dragging after 4px movement (prevents conflict with double-click)
    if (!dragging.current && Math.abs(dx) + Math.abs(dy) < 4) return
    dragging.current = true

    const curScale = scaleRef.current
    const clockW = BASE_CLOCK_WIDTH * curScale
    const clockH = BASE_CLOCK_HEIGHT * curScale
    const newX = Math.max(0, Math.min(window.innerWidth  - clockW, ds.ox + dx))
    const newY = Math.max(0, Math.min(window.innerHeight - clockH, ds.oy + dy))
    const nextPos = { x: newX, y: newY }
    posRef.current = nextPos
    setPos(nextPos)
  }, [])

  const handlePointerUp = useCallback(() => {
    dragStart.current.pressed = false
    if (dragging.current) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)) } catch { /* private mode */ }
    }
    dragging.current = false
  }, [])

  /* ── Grip resize (scale) ───────────────────────────── */

  const handleGripPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.stopPropagation() // prevent body drag from starting
    resizing.current = true
    resizeStart.current = {
      px: e.clientX,
      py: e.clientY,
      os: scaleRef.current,
      pressed: true,
    }
    const el = gripRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [])

  const handleGripPointerMove = useCallback((e) => {
    const rs = resizeStart.current
    if (!rs.pressed) return
    // Flipped movement:
    // Dragging down/right (away from top-left anchor) → zoom in / enlarge
    // Dragging up/left (towards top-left anchor) → zoom out / shrink
    const dx = e.clientX - rs.px
    const dy = e.clientY - rs.py
    const delta = (dx + dy) / 2
    const next = Math.max(0.5, Math.min(3.0, rs.os + delta / 120))
    const rounded = Number(next.toFixed(2))
    scaleRef.current = rounded
    setScale(rounded)
  }, [])

  const handleGripPointerUp = useCallback(() => {
    resizeStart.current.pressed = false
    resizing.current = false
    try { localStorage.setItem(SCALE_KEY, scaleRef.current.toString()) } catch { /* private mode */ }
  }, [])

  /* ── Wheel resize ──────────────────────────── */

  const handleWheel = useCallback((e) => {
    setScale((prev) => {
      // Flipped: scroll down (deltaY > 0) zooms in, scroll up (deltaY < 0) zooms out
      const ds = e.deltaY > 0 ? 0.05 : -0.05
      const next = Math.max(0.5, Math.min(3.0, Number((prev + ds).toFixed(2))))
      scaleRef.current = next
      try { localStorage.setItem(SCALE_KEY, next.toString()) } catch { /* private mode */ }
      return next
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
          <div className="flex items-center gap-1">
            <Digit value={t.h1} />
            <Digit value={t.h2} />
            <span className="flex h-11 w-2.5 items-center justify-center text-lg font-bold text-accent select-none">:</span>
            <Digit value={t.m1} />
            <Digit value={t.m2} />
          </div>

          <div className="flex w-full items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-bold tracking-widest text-accent">
              {t.period}
            </span>
            <span className="text-[11px] font-medium text-muted/90">{t.dateLabel}</span>
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
