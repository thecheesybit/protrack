import { useEffect, useState, useRef, useCallback, memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { GripHorizontal, Bell } from 'lucide-react'
import { playPop } from '@/lib/audioFX'
import { useStore } from '@/store/useStore'
import { cn } from '@/utils/cn'

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

export const CENTERED_SCALE = 3.5

export function getCenteredPos(currentScale = CENTERED_SCALE) {
  const scaledWidth = BASE_CLOCK_WIDTH * currentScale
  const scaledHeight = BASE_CLOCK_HEIGHT * currentScale
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800
  return {
    x: Math.max(0, (winW - scaledWidth) / 2),
    y: Math.max(0, (winH - scaledHeight) / 2),
  }
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
  const clockCentered = useStore((s) => s.clockCentered)
  const toggleClockCentered = useStore((s) => s.toggleClockCentered)
  const setAlarmModalOpen = useStore((s) => s.setAlarmModalOpen)

  // Track window dimensions for dynamic centering
  const [winSize, setWinSize] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1200,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }))

  useEffect(() => {
    const onResize = () => {
      setWinSize({
        w: window.innerWidth,
        h: window.innerHeight,
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  // Base clock layout dimensions for pixel-perfect centering
  const baseW = clockRef.current?.offsetWidth || 180
  const baseH = clockRef.current?.offsetHeight || 92

  // Calculate centered coordinates
  const centeredX = Math.max(0, (winSize.w - baseW * CENTERED_SCALE) / 2)
  const centeredY = Math.max(0, (winSize.h - baseH * CENTERED_SCALE) / 2)

  const targetX = clockCentered ? centeredX : pos.x
  const targetY = clockCentered ? centeredY : pos.y
  const targetScale = clockCentered ? CENTERED_SCALE : scale

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
    if (clockCentered) return
    if (e.button !== 0) return
    // Don't start a body drag if the grip is initiating a resize
    if (resizing.current) return
    dragging.current = false
    dragStart.current = { px: e.clientX, py: e.clientY, ox: posRef.current.x, oy: posRef.current.y, pressed: true }
    const el = clockRef.current
    if (el) el.setPointerCapture(e.pointerId)
  }, [clockCentered])

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
    if (clockCentered) return
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
  }, [clockCentered])

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
    if (clockCentered) return
    setScale((prev) => {
      // Flipped: scroll down (deltaY > 0) zooms in, scroll up (deltaY < 0) zooms out
      const ds = e.deltaY > 0 ? 0.05 : -0.05
      const next = Math.max(0.5, Math.min(3.0, Number((prev + ds).toFixed(2))))
      scaleRef.current = next
      try { localStorage.setItem(SCALE_KEY, next.toString()) } catch { /* private mode */ }
      return next
    })
  }, [clockCentered])

  /* ── Double-click: toggle pin / auto-hide or return from centered ─── */

  const handleDoubleClick = useCallback(() => {
    if (dragging.current) return // was a drag, not a dbl-click
    if (clockCentered) {
      toggleClockCentered()
      return
    }
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
  }, [clockCentered, toggleClockCentered])

  /* ── Visibility ────────────────────────────────────── */

  const hiddenByAuto = !clockCentered && mode === 'auto' && !focusLocked && (chromeHidden || fullscreen || focusRunning)

  // Safe space is available in area (C) below the legend (which has 2cm extra bottom clearance),
  // so the clock remains visible when legends expand.
  const isHidden = hiddenByAuto

  return (
    <>
      <AnimatePresence>
      {!isHidden && (
        <motion.div
          ref={clockRef}
          key="flip-clock"
          initial={{ opacity: 0, scale: 0.9 * scale }}
          animate={{
            opacity: 1,
            scale: targetScale,
            left: targetX,
            top: targetY,
          }}
          exit={{ opacity: 0, scale: 0.9 * scale }}
          transition={{
            opacity: { duration: 0.35, ease: [0.2, 0, 0, 1] },
            scale: { type: 'spring', stiffness: 320, damping: 28 },
            left: { type: 'spring', stiffness: 320, damping: 28 },
            top: { type: 'spring', stiffness: 320, damping: 28 },
          }}
          onDoubleClick={handleDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          title={
            clockCentered
              ? 'Desk Clock Mode · Press Ctrl+T, Esc, or double-click to return'
              : mode === 'pinned'
              ? 'Double-click to enable auto-hide · Drag to move · Scroll/grip to resize · Ctrl+T to center'
              : 'Double-click to pin clock · Drag to move · Scroll/grip to resize · Ctrl+T to center'
          }
          className={cn(
            "fixed z-[55] flex w-[180px] select-none flex-col items-center gap-2 rounded-2xl border bg-surface/80 px-3 py-3 shadow-glass backdrop-blur-xl transition-colors touch-none group",
            clockCentered
              ? "cursor-default border-accent/40 shadow-glow ring-1 ring-accent/25"
              : "cursor-grab border-line/50 hover:border-accent/40 active:cursor-grabbing"
          )}
          style={{
            transformOrigin: 'top left',
          }}
          aria-label={`Flip clock — ${clockCentered ? 'Centered' : mode} mode`}
        >
          {/* Tactile Alarm Button below flip clock (hidden when expanded to large scene in Ctrl+T mode) */}
          {!clockCentered && (
            <motion.button
              type="button"
              data-testid="flipclock-alarm-tab"
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{
                y: 4,
                scale: 0.96,
                transition: { type: 'spring', stiffness: 900, damping: 15 },
              }}
              onClick={(e) => {
                e.stopPropagation()
                try { playPop() } catch { /* noop */ }
                setAlarmModalOpen(true)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              title="Set Alarm / Reminder (Alt + A)"
              className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 rounded-xl border border-line/80 border-b-[3px] border-b-black/50 bg-gradient-to-b from-surface/95 via-surface to-surface-2/90 px-3 py-1 text-[10px] font-bold text-ink/90 shadow-[0_4px_0_0_rgba(0,0,0,0.4),0_6px_12px_rgba(0,0,0,0.25)] backdrop-blur-xl cursor-pointer select-none group/alarmtab transition-colors active:border-b active:shadow-[0_1px_0_0_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.2)]"
            >
              <Bell className="h-3 w-3 text-accent transition-transform group-hover/alarmtab:rotate-12 group-hover/alarmtab:scale-110" />
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-ink group-hover/alarmtab:text-accent">
                Alarm
              </span>
            </motion.button>
          )}

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

          {/* Mode indicator dot (hidden in centered mode) */}
          {!clockCentered && (
            <span
              className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
                mode === 'pinned' ? 'bg-accent' : 'bg-muted/50'
              }`}
              title={mode === 'pinned' ? 'Pinned' : 'Auto-hide'}
            />
          )}

          {/* Bottom-right resize grip — visible on hover when not centered */}
          {!clockCentered && (
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
          )}

        </motion.div>
      )}
    </AnimatePresence>

    {/* Return hint badge — centered at the bottom of the screen */}
    <AnimatePresence>
      {clockCentered && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: '28px',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <motion.button
            key="clock-centered-hint"
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={toggleClockCentered}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-surface/90 px-4 py-1.5 text-[11px] font-medium tracking-wide text-muted shadow-glass backdrop-blur-xl transition-all hover:border-accent/40 hover:bg-surface hover:text-ink hover:scale-105 cursor-pointer select-none"
            title="Click or press Ctrl+T / Esc to return to dashboard"
          >
            <span>Press</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-accent font-bold">
              Ctrl + T
            </kbd>
            <span>or Esc to return</span>
          </motion.button>
        </div>
      )}
    </AnimatePresence>
    </>
  )
}
