import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown, ChevronLeft } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getIcon } from '@/lib/icons'
import { WIDGETS } from '@/components/widgets/widgetRegistry'
import { getWidgetComponent } from '@/components/widgets/widgetComponents'
import { getWidgetVideo } from '@/lib/videoPacks'
import { cn } from '@/utils/cn'

// ── Layout config ─────────────────────────────────────────────────────────────
// Timetable is permanently anchored on the left.
// The right slot starts with Todos but is swappable with any mini-card.
const LEFT_ID = 'timetable'
const DEFAULT_RIGHT_ID = 'todos'

// Natural display order for the bottom row (used to keep consistent ordering)
const ALL_SWAPPABLE = ['todos', 'focus', 'habits', 'notes', 'subjects', 'scorecard', 'analytics', 'ledger']

const MINI_META = {
  todos:     { desc: 'Tasks',         gradient: 'from-sky-500/15 to-blue-500/10' },
  focus:     { desc: 'Deep Work',     gradient: 'from-violet-500/15 to-indigo-500/10' },
  habits:    { desc: 'Daily Habits',  gradient: 'from-emerald-500/15 to-teal-500/10' },
  notes:     { desc: 'Scratchpad',    gradient: 'from-amber-500/15 to-yellow-500/10' },
  subjects:  { desc: 'Syllabus',      gradient: 'from-cyan-500/15 to-sky-500/10' },
  scorecard: { desc: 'Exams & Mocks', gradient: 'from-amber-500/15 to-emerald-500/10' },
  analytics: { desc: 'Insights',      gradient: 'from-amber-500/15 to-orange-500/10' },
  ledger:    { desc: 'Milestones',    gradient: 'from-rose-500/15 to-pink-500/10' },
}

// ── Components ────────────────────────────────────────────────────────────────

function Widget({ widget, variant, context = null }) {
  const Component = getWidgetComponent(widget.id)
  // `context` is the P7 nav-bus moduleContext for THIS widget (or null). P8
  // widgets read it to scroll-to / highlight `context.itemId`; today's widgets
  // simply ignore the extra prop.
  return <Component widget={widget} variant={variant} context={context} />
}

/** Minimal dock trigger shown alongside the hero when a widget is maximised. */
function DockChip({ widget, onClick, isActive }) {
  const Icon = getIcon(widget.icon)
  return (
    <motion.button
      layout
      onClick={onClick}
      title={widget.title}
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-200 backdrop-blur-xl",
        isActive
          ? "border-accent bg-accent/20 text-accent shadow-glow-sm"
          : "border-line/60 bg-surface/60 text-muted hover:border-accent/40 hover:text-ink"
      )}
    >
      {/* Active Indicator bar on the left */}
      {isActive && (
        <motion.div
          layoutId="active-indicator"
          className="absolute -left-1.5 h-6 w-1 rounded-r-full bg-accent"
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        />
      )}
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute right-14 top-1/2 -translate-y-1/2 z-20 whitespace-nowrap rounded-lg border border-line/60 bg-surface px-2.5 py-1.5 text-xs font-medium opacity-0 shadow-glass transition-opacity group-hover:opacity-100">
        {widget.title}
      </span>
    </motion.button>
  )
}

/**
 * Beautiful mini card for secondary widgets in the bottom row.
 * Single-click: swap into the right primary slot.
 * Double-click: open in full-screen hero mode.
 */
function MiniCard({ widget, isDockOpen = true, onSingleClick, onDoubleClick }) {
  const Icon = getIcon(widget.icon)
  const meta = MINI_META[widget.id] || { desc: '', gradient: 'from-accent/15 to-accent-2/10' }
  const clickTimer = useRef(null)
  const videoRef = useRef(null)
  const videoSrc = useMemo(() => getWidgetVideo(widget.id), [widget.id])

  useEffect(() => {
    if (!isDockOpen && videoRef.current) {
      videoRef.current.pause()
    }
  }, [isDockOpen])

  const handleClick = () => {
    if (clickTimer.current) {
      // Second click within 280ms → double-click
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      onDoubleClick()
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        onSingleClick()
      }, 280)
    }
  }

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative flex min-w-[120px] sm:min-w-[135px] flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/60 p-3 sm:p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:bg-surface/80 hover:shadow-glow-sm cursor-pointer select-none isolate [clip-path:inset(0_round_1.5rem)] gpu-layer"
    >
      {/* Dynamic ambient video background - plays on hover only */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          loop
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 transition-all duration-700 ease-out group-hover:scale-105 group-hover:opacity-60"
        />
      )}

      {/* Glassmorphic scrim over video with balanced transparency for 10% more video clarity & crisp text contrast */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/80 via-surface/50 to-surface/20 backdrop-blur-[0.5px]" />

      {/* Subtle gradient backdrop */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-40 transition-opacity duration-300 group-hover:opacity-80',
        meta.gradient,
      )} />

      {/* Inner highlight rim — hugs the exact rounded-3xl curve */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-accent/0 transition-all duration-300 group-hover:ring-accent/25" />

      {/* Soft inner ambient glow */}
      <div className="pointer-events-none absolute -bottom-10 left-1/2 h-20 w-3/4 -translate-x-1/2 rounded-full bg-accent/20 blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2 max-w-full">
        <span className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent/8 text-accent shadow-glow-sm ring-1 ring-accent/20 transition-transform duration-200 group-hover:scale-105 shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
        <span className="font-display text-xs sm:text-sm font-semibold tracking-tight text-ink truncate max-w-[115px]">{widget.title}</span>
        <span className="max-w-[110px] truncate rounded-full border border-white/5 bg-white/5 px-2.5 py-0.5 text-[calc(0.625rem*var(--text-scale,1))] font-medium text-muted/70 transition-colors group-hover:border-white/10 group-hover:text-muted/90">
          {meta.desc}
        </span>
      </div>

      {/* Refined bottom selection light — strictly inside the flat base */}
      <div className="pointer-events-none absolute bottom-1.5 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-0 blur-[0.5px] transition-all duration-300 group-hover:w-2/5 group-hover:opacity-100" />
    </button>
  )
}

/**
 * The single unified board canvas.
 *
 * DEFAULT STATE:
 *   Top row (~65% height): Timetable (permanent, left) + Swappable widget (right)
 *   Bottom row (~35% height): remaining widgets as minimal aesthetic cards
 *   Single-click a mini card → swaps it into the right slot
 *   Double-click a mini card → opens full-screen hero mode
 *
 * MAXIMISED STATE (double-click):
 *   Clicked widget → full hero pane + sidebar dock of all others.
 */
export function BoardCanvas() {
  const maximizedWidgetId = useStore((s) => s.maximizedWidgetId)
  const maximizeWidget = useStore((s) => s.maximizeWidget)
  const scopeDropdownOpen = useStore((s) => s.scopeDropdownOpen)

  // ── P7 cross-module nav bus ───────────────────────────────────────────────
  const moduleContext = useStore((s) => s.moduleContext)
  const navStack = useStore((s) => s.navStack)
  const navBack = useStore((s) => s.navBack)
  const lastNavSeqRef = useRef(null)
  const contextFor = (id) => (moduleContext && moduleContext.widgetId === id ? moduleContext : null)

  const [rightId, setRightId] = useState(DEFAULT_RIGHT_ID)

  // Per-widget "minimized to header" state (uiSlice). Drives the right-column
  // auto-stack: every collapsed widget in the stack pulls the next dock widget
  // in below it so the freed space never sits empty.
  const collapsedWidgets = useStore((s) => s.collapsedWidgets)

  const maximized = WIDGETS.find((w) => w.id === maximizedWidgetId)

  const leftWidget = WIDGETS.find((w) => w.id === LEFT_ID)

  // Right column is a vertical stack. It starts with the chosen right widget and
  // grows by one dock widget for each consecutive collapsed member — so there's
  // always exactly one expanded widget filling the space, plus N headers.
  const rightStackIds = (() => {
    const stack = [rightId]
    const pool = ALL_SWAPPABLE.filter((id) => id !== rightId)
    while (collapsedWidgets[stack[stack.length - 1]] && pool.length) {
      stack.push(pool.shift())
    }
    return stack
  })()
  const rightStack = rightStackIds
    .map((id) => WIDGETS.find((w) => w.id === id))
    .filter(Boolean)

  // Bottom row: every swappable widget not currently living in the right stack,
  // in the natural order.
  const bottomWidgets = ALL_SWAPPABLE
    .filter((id) => !rightStackIds.includes(id))
    .map((id) => WIDGETS.find((w) => w.id === id))
    .filter(Boolean)

  const toggleWidget = useStore((s) => s.toggleWidget)

  // ── Split & Focus State ────────────────────────────────────────────────────
  const SPLIT_KEY = 'protrack:board_split_ratio'
  const DEFAULT_SPLIT = 0.58 // 58% timetable (left), 42% swappable right widget

  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const v = typeof localStorage !== 'undefined' && localStorage.getItem(SPLIT_KEY)
      if (v) {
        const parsed = parseFloat(v)
        if (!isNaN(parsed) && parsed >= 0.35 && parsed <= 0.75) return parsed
      }
    } catch { /* fallback */ }
    return DEFAULT_SPLIT
  })

  const isDraggingDivider = useRef(false)
  const topRowRef = useRef(null)
  const cachedRectRef = useRef(null)
  const rafIdRef = useRef(null)
  const latestClientXRef = useRef(0)

  // ── Hover Auto-Expansion State (2-second intentional dwell) ───────────────
  const DWELL_DELAY_MS = 2000 // Exact 2s dwell: zero accidental jitter on quick passes
  const LEAVE_DELAY_MS = 450  // Smooth, relaxed restoration

  const hoverTimerRef = useRef(null)
  const leaveTimerRef = useRef(null)
  const [focusedSlot, setFocusedSlot] = useState(null) // 'left' | 'right' | null

  // Clean up timers & rAF on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  const handleMouseEnterSlot = useCallback((slot) => {
    if (isDraggingDivider.current) return
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
    }
    hoverTimerRef.current = setTimeout(() => {
      setFocusedSlot(slot)
    }, DWELL_DELAY_MS)
  }, [])

  const handleMouseLeaveSlot = useCallback((slot) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
    }
    leaveTimerRef.current = setTimeout(() => {
      setFocusedSlot((curr) => (curr === slot ? null : curr))
    }, LEAVE_DELAY_MS)
  }, [])

  // Draggable splitter interaction with rAF throttling & rect caching
  const handleDividerPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    setFocusedSlot(null)
    isDraggingDivider.current = true
    cachedRectRef.current = topRowRef.current?.getBoundingClientRect() || null
    latestClientXRef.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const handleDividerPointerMove = useCallback((e) => {
    if (!isDraggingDivider.current) return
    latestClientXRef.current = e.clientX
    if (rafIdRef.current !== null) return

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const rect = cachedRectRef.current || topRowRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0) return
      const x = latestClientXRef.current - rect.left
      const newRatio = Math.max(0.35, Math.min(0.75, x / rect.width))
      setSplitRatio(Number(newRatio.toFixed(3)))
    })
  }, [])

  const handleDividerPointerUp = useCallback(() => {
    if (!isDraggingDivider.current) return
    isDraggingDivider.current = false
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    cachedRectRef.current = null
    try {
      localStorage.setItem(SPLIT_KEY, splitRatio.toString())
    } catch { /* private mode */ }
  }, [splitRatio])

  const resetSplit = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    setFocusedSlot(null)
    setSplitRatio(DEFAULT_SPLIT)
    try {
      localStorage.setItem(SPLIT_KEY, DEFAULT_SPLIT.toString())
    } catch { /* private mode */ }
  }, [])

  // ── Bottom Dock Auto-Hide & Notch State ────────────────────────────────────
  const DOCK_HIDE_DELAY_MS = 5000 // 5 seconds of inactivity outside bottom area
  const isBottomDockOpen = useStore((s) => s.bottomDockOpen)
  const setIsBottomDockOpen = useStore((s) => s.setBottomDockOpen)
  const bottomDockTimerRef = useRef(null)

  useEffect(() => {
    const handleToggle = () => setIsBottomDockOpen(!useStore.getState().bottomDockOpen)
    window.addEventListener('protrack:toggle-bottom-dock', handleToggle)
    return () => window.removeEventListener('protrack:toggle-bottom-dock', handleToggle)
  }, [setIsBottomDockOpen])

  const handleBottomAreaMouseEnter = useCallback(() => {
    if (bottomDockTimerRef.current) {
      clearTimeout(bottomDockTimerRef.current)
      bottomDockTimerRef.current = null
    }
    setIsBottomDockOpen(true)
  }, [setIsBottomDockOpen])

  const handleBottomAreaMouseLeave = useCallback(() => {
    if (bottomDockTimerRef.current) {
      clearTimeout(bottomDockTimerRef.current)
    }
    bottomDockTimerRef.current = setTimeout(() => {
      setIsBottomDockOpen(false)
    }, DOCK_HIDE_DELAY_MS)
  }, [setIsBottomDockOpen])

  // Auto-hide bottom dock 5s after launch if cursor is not in that area
  useEffect(() => {
    bottomDockTimerRef.current = setTimeout(() => {
      setIsBottomDockOpen(false)
    }, DOCK_HIDE_DELAY_MS)
    return () => {
      if (bottomDockTimerRef.current) clearTimeout(bottomDockTimerRef.current)
    }
  }, [setIsBottomDockOpen])

  // ── P7 nav bus: surface the widget a moduleContext points at ──────────────
  // `activate: false` contexts (e.g. from openFocus, whose overlay owns the
  // screen) are recorded but never move the board. `seq` guards against
  // re-running for the same nav intent. P8 widgets pick up the `context` prop.
  useEffect(() => {
    if (!moduleContext || moduleContext.activate === false) return
    if (moduleContext.seq === lastNavSeqRef.current) return
    lastNavSeqRef.current = moduleContext.seq
    const { widgetId } = moduleContext
    if (!WIDGETS.some((w) => w.id === widgetId)) return
    maximizeWidget(widgetId)
    if (ALL_SWAPPABLE.includes(widgetId)) setRightId(widgetId)
  }, [moduleContext, maximizeWidget])

  // ── Maximised: dock + hero ────────────────────────────────────────────────
  if (maximized) {
    return (
      <div className="flex h-full gap-3 p-1">
        <div className="flex shrink-0 flex-col gap-2 overflow-y-auto no-scrollbar max-h-full">
          {navStack.length > 0 && moduleContext?.activate !== false && (
            <button
              onClick={navBack}
              title="Back to previous view"
              aria-label="Back to previous view"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line/60 bg-surface/60 text-muted backdrop-blur-xl transition-all duration-200 hover:border-accent/40 hover:text-ink"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {WIDGETS.map((w) => (
            <DockChip
              key={w.id}
              widget={w}
              isActive={w.id === maximizedWidgetId}
              onClick={() => toggleWidget(w.id)}
            />
          ))}
        </div>
        <div className="min-h-0 flex-1">
          <Widget widget={maximized} variant="hero" context={contextFor(maximized.id)} />
        </div>
      </div>
    )
  }

  // Calculate smooth proportional split ratios with 2s hover auto-expansion
  let leftFlex = splitRatio * 100
  let rightFlex = 100 - leftFlex

  if (focusedSlot === 'left') {
    leftFlex = Math.max(splitRatio * 100, 72)
    rightFlex = 100 - leftFlex
  } else if (focusedSlot === 'right') {
    rightFlex = Math.max((1 - splitRatio) * 100, 64)
    leftFlex = 100 - rightFlex
  }

  // ── Default: primary grid + secondary mini cards ──────────────────────────
  return (
    <div className="flex h-full flex-col gap-4 p-1">
      {/* Top row: Timetable + Swappable right widget */}
      <div
        ref={topRowRef}
        className="relative flex min-h-0 flex-1 items-stretch gap-3"
      >
        {leftWidget && (
          <div
            onMouseEnter={() => handleMouseEnterSlot('left')}
            onMouseLeave={() => handleMouseLeaveSlot('left')}
            style={{
              flexBasis: `${leftFlex}%`,
              transition: isDraggingDivider.current ? 'none' : 'flex-basis 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="relative min-h-0 min-w-0 flex-1 rounded-3xl"
          >
            <div className="h-full">
              <Widget widget={leftWidget} variant="grid" context={contextFor(leftWidget.id)} />
            </div>
          </div>
        )}

        {/* Elegant split divider handle */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuenow={Math.round(splitRatio * 100)}
          aria-valuemin={35}
          aria-valuemax={75}
          aria-label="Resize left and right panels"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setSplitRatio((r) => {
                const next = Math.max(0.35, Number((r - 0.05).toFixed(3)))
                try { localStorage.setItem(SPLIT_KEY, next.toString()) } catch { /* best-effort persistence */ }
                return next
              })
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              setSplitRatio((r) => {
                const next = Math.min(0.75, Number((r + 0.05).toFixed(3)))
                try { localStorage.setItem(SPLIT_KEY, next.toString()) } catch { /* best-effort persistence */ }
                return next
              })
            } else if (e.key === 'Home' || e.key === 'Enter') {
              e.preventDefault()
              resetSplit()
            }
          }}
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={handleDividerPointerUp}
          onPointerCancel={handleDividerPointerUp}
          onDoubleClick={resetSplit}
          title="Drag or use Left/Right arrow keys to adjust split · Double-click or Home to reset"
          className="group relative flex w-3.5 shrink-0 cursor-col-resize items-center justify-center -mx-1.5 z-20 select-none touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
        >
          {/* Ambient hairline */}
          <div className="h-full w-[1px] bg-white/[0.06] transition-colors group-hover:bg-accent/40" />
          {/* Tactile grip pill */}
          <div className="absolute flex h-10 w-4 items-center justify-center rounded-full border border-line/60 bg-surface/90 shadow-glass backdrop-blur-md transition-all duration-200 group-hover:scale-110 group-hover:border-accent group-hover:bg-surface group-hover:shadow-glow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="h-0.5 w-1.5 rounded-full bg-muted/80 group-hover:bg-accent" />
              <span className="h-0.5 w-1.5 rounded-full bg-muted/80 group-hover:bg-accent" />
              <span className="h-0.5 w-1.5 rounded-full bg-muted/80 group-hover:bg-accent" />
            </div>
          </div>
        </div>

        {rightStack.length > 0 && (
          <div
            onMouseEnter={() => handleMouseEnterSlot('right')}
            onMouseLeave={() => handleMouseLeaveSlot('right')}
            style={{
              flexBasis: `${rightFlex}%`,
              transition: isDraggingDivider.current ? 'none' : 'flex-basis 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 rounded-3xl"
          >
            {rightStack.map((w) => {
              const isCollapsed = Boolean(collapsedWidgets[w.id])
              return (
                <div
                  key={w.id}
                  className={cn('min-w-0', isCollapsed ? 'shrink-0' : 'min-h-0 flex-1')}
                >
                  <Widget widget={w} variant="grid" context={contextFor(w.id)} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom row wrapper: mini-cards + hover notch with 5s auto-hide */}
      <div
        onMouseEnter={handleBottomAreaMouseEnter}
        onMouseLeave={handleBottomAreaMouseLeave}
        className="group/bottom relative flex shrink-0 flex-col items-center justify-end"
      >
        {/* Manual quick-hide button on hover when dock is open */}
        {isBottomDockOpen && (
          <button
            type="button"
            onClick={() => setIsBottomDockOpen(false)}
            title="Hide workspaces dock (or auto-hides after 5s outside)"
            className="absolute -top-3 right-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-surface/90 text-muted opacity-0 shadow-glass backdrop-blur-md transition-all duration-200 group-hover/bottom:opacity-100 hover:border-accent/50 hover:bg-surface hover:text-ink hover:scale-105 cursor-pointer"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}

        {/* The Small Boxes (Mini cards) */}
        <div
          style={{
            height: isBottomDockOpen ? '215px' : '0px',
            opacity: isBottomDockOpen ? 1 : 0,
            transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease',
          }}
          className={cn(
            "flex w-full shrink-0 gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1 px-0.5",
            !isBottomDockOpen && "pointer-events-none"
          )}
        >
          {bottomWidgets.map((w) => (
            <MiniCard
              key={w.id}
              widget={w}
              isDockOpen={isBottomDockOpen}
              onSingleClick={() => setRightId(w.id)}
              onDoubleClick={() => maximizeWidget(w.id)}
            />
          ))}
        </div>

        {/* Collapsed Notch Bar */}
        <div
          style={{
            height: isBottomDockOpen ? '0px' : '32px',
            opacity: isBottomDockOpen || scopeDropdownOpen ? 0 : 1,
            pointerEvents: isBottomDockOpen || scopeDropdownOpen ? 'none' : 'auto',
            transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease',
          }}
          className="flex w-full items-center justify-center overflow-hidden"
        >
          <button
            type="button"
            onClick={handleBottomAreaMouseEnter}
            className="group/notch relative flex h-7 items-center gap-2 rounded-full border border-white/10 bg-surface/90 px-4 shadow-glass backdrop-blur-2xl transition-all duration-300 hover:scale-105 hover:border-accent/60 hover:bg-surface hover:shadow-glow-sm cursor-pointer select-none"
            title="Move mouse here to expand workspace dock"
          >
            {/* Ambient accent glow on hover */}
            <div className="pointer-events-none absolute inset-x-3 -bottom-1 h-1.5 rounded-full bg-accent/40 blur-sm opacity-60 transition-opacity group-hover/notch:opacity-100" />
            <ChevronUp className="h-3.5 w-3.5 text-accent transition-transform duration-200 group-hover/notch:-translate-y-0.5" />
            <span className="font-display text-xs font-semibold tracking-tight text-ink/90">
              Workspaces & Widgets
            </span>
            <span className="flex h-4 items-center rounded-full bg-accent/20 px-1.5 text-[calc(0.625rem*var(--text-scale,1))] font-mono font-bold text-accent">
              {bottomWidgets.length}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
