import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown, ChevronLeft } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getIcon } from '@/lib/icons'
import { WIDGETS } from '@/components/widgets/widgetRegistry'
import { getWidgetComponent } from '@/components/widgets/widgetComponents'
import { cn } from '@/utils/cn'

// ── Layout config ─────────────────────────────────────────────────────────────
// Timetable is permanently anchored on the left.
// The right slot starts with Todos but is swappable with any mini-card.
const LEFT_ID = 'timetable'
const DEFAULT_RIGHT_ID = 'todos'

// Natural display order for the bottom row (used to keep consistent ordering)
const ALL_SWAPPABLE = ['todos', 'focus', 'habits', 'notes', 'subjects', 'scorecard', 'analytics', 'ledger']

const MINI_META = {
  todos:     { desc: 'Task backlog',         gradient: 'from-sky-500/15 to-blue-500/10' },
  focus:     { desc: 'Deep work sessions',   gradient: 'from-violet-500/15 to-indigo-500/10' },
  habits:    { desc: 'Track daily routines', gradient: 'from-emerald-500/15 to-teal-500/10' },
  notes:     { desc: 'Memory & dropbox',     gradient: 'from-amber-500/15 to-yellow-500/10' },
  subjects:  { desc: 'Study progress',       gradient: 'from-cyan-500/15 to-sky-500/10' },
  scorecard: { desc: 'Exam & mock tracker',  gradient: 'from-amber-500/15 to-emerald-500/10' },
  analytics: { desc: 'Progress insights',    gradient: 'from-amber-500/15 to-orange-500/10' },
  ledger:    { desc: 'Achievement history',  gradient: 'from-rose-500/15 to-pink-500/10' },
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
function MiniCard({ widget, onSingleClick, onDoubleClick }) {
  const Icon = getIcon(widget.icon)
  const meta = MINI_META[widget.id] || { desc: '', gradient: 'from-accent/15 to-accent-2/10' }
  const clickTimer = useRef(null)

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

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative flex flex-1 flex-col items-center justify-center gap-2.5 overflow-hidden rounded-3xl border border-white/[0.08] bg-surface/60 p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:bg-surface/80 hover:shadow-glow-sm cursor-pointer select-none isolate [clip-path:inset(0_round_1.5rem)]"
    >
      {/* Subtle gradient backdrop */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-300 group-hover:opacity-90',
        meta.gradient,
      )} />

      {/* Inner highlight rim — hugs the exact rounded-3xl curve */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-accent/0 transition-all duration-300 group-hover:ring-accent/25" />

      {/* Soft inner ambient glow */}
      <div className="pointer-events-none absolute -bottom-10 left-1/2 h-20 w-3/4 -translate-x-1/2 rounded-full bg-accent/20 blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent/8 text-accent shadow-glow-sm ring-1 ring-accent/20 transition-transform duration-200 group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
        <span className="font-display text-sm font-semibold tracking-tight text-ink">{widget.title}</span>
        <span className="rounded-full border border-white/5 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-muted/70 transition-colors group-hover:border-white/10 group-hover:text-muted/90">
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

  // ── P7 cross-module nav bus ───────────────────────────────────────────────
  const moduleContext = useStore((s) => s.moduleContext)
  const navStack = useStore((s) => s.navStack)
  const navBack = useStore((s) => s.navBack)
  const lastNavSeqRef = useRef(null)
  const contextFor = (id) => (moduleContext && moduleContext.widgetId === id ? moduleContext : null)

  const [rightId, setRightId] = useState(DEFAULT_RIGHT_ID)

  const maximized = WIDGETS.find((w) => w.id === maximizedWidgetId)
  const others = WIDGETS.filter((w) => w.id !== maximizedWidgetId)

  const leftWidget = WIDGETS.find((w) => w.id === LEFT_ID)
  const rightWidget = WIDGETS.find((w) => w.id === rightId)

  // Bottom row: all swappable widgets EXCEPT the one currently in the right slot,
  // maintaining a consistent natural order.
  const bottomWidgets = ALL_SWAPPABLE
    .filter((id) => id !== rightId)
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

  // ── Hover Auto-Expansion State (2-second intentional dwell) ───────────────
  const DWELL_DELAY_MS = 2000 // Exact 2s dwell: zero accidental jitter on quick passes
  const LEAVE_DELAY_MS = 450  // Smooth, relaxed restoration

  const hoverTimerRef = useRef(null)
  const leaveTimerRef = useRef(null)
  const [focusedSlot, setFocusedSlot] = useState(null) // 'left' | 'right' | null

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
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

  // Draggable splitter interaction
  const handleDividerPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    setFocusedSlot(null)
    isDraggingDivider.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const handleDividerPointerMove = useCallback((e) => {
    if (!isDraggingDivider.current || !topRowRef.current) return
    const rect = topRowRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newRatio = Math.max(0.35, Math.min(0.75, x / rect.width))
    setSplitRatio(Number(newRatio.toFixed(3)))
  }, [])

  const handleDividerPointerUp = useCallback(() => {
    if (!isDraggingDivider.current) return
    isDraggingDivider.current = false
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
  const [isBottomDockOpen, setIsBottomDockOpen] = useState(true)
  const bottomDockTimerRef = useRef(null)

  const handleBottomAreaMouseEnter = useCallback(() => {
    if (bottomDockTimerRef.current) {
      clearTimeout(bottomDockTimerRef.current)
      bottomDockTimerRef.current = null
    }
    setIsBottomDockOpen(true)
  }, [])

  const handleBottomAreaMouseLeave = useCallback(() => {
    if (bottomDockTimerRef.current) {
      clearTimeout(bottomDockTimerRef.current)
    }
    bottomDockTimerRef.current = setTimeout(() => {
      setIsBottomDockOpen(false)
    }, DOCK_HIDE_DELAY_MS)
  }, [])

  // Auto-hide bottom dock 5s after launch if cursor is not in that area
  useEffect(() => {
    bottomDockTimerRef.current = setTimeout(() => {
      setIsBottomDockOpen(false)
    }, DOCK_HIDE_DELAY_MS)
    return () => {
      if (bottomDockTimerRef.current) clearTimeout(bottomDockTimerRef.current)
    }
  }, [])

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
        <div className="flex shrink-0 flex-col gap-2">
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
            className="min-h-0 min-w-0 flex-1 rounded-3xl"
          >
            <div className="h-full">
              <Widget widget={leftWidget} variant="grid" context={contextFor(leftWidget.id)} />
            </div>
          </div>
        )}

        {/* Elegant split divider handle */}
        <div
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={handleDividerPointerUp}
          onPointerCancel={handleDividerPointerUp}
          onDoubleClick={resetSplit}
          title="Drag to adjust split · Double-click to reset"
          className="group relative flex w-3.5 shrink-0 cursor-col-resize items-center justify-center -mx-1.5 z-20 select-none touch-none"
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

        {rightWidget && (
          <div
            onMouseEnter={() => handleMouseEnterSlot('right')}
            onMouseLeave={() => handleMouseLeaveSlot('right')}
            style={{
              flexBasis: `${rightFlex}%`,
              transition: isDraggingDivider.current ? 'none' : 'flex-basis 0.38s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="min-h-0 min-w-0 flex-1 rounded-3xl"
          >
            <div className="h-full">
              <Widget widget={rightWidget} variant="grid" context={contextFor(rightWidget.id)} />
            </div>
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
            "flex w-full shrink-0 gap-4 overflow-hidden py-1 px-0.5",
            !isBottomDockOpen && "pointer-events-none"
          )}
        >
          {bottomWidgets.map((w) => (
            <MiniCard
              key={w.id}
              widget={w}
              onSingleClick={() => setRightId(w.id)}
              onDoubleClick={() => maximizeWidget(w.id)}
            />
          ))}
        </div>

        {/* Collapsed Notch Bar */}
        <div
          style={{
            height: isBottomDockOpen ? '0px' : '32px',
            opacity: isBottomDockOpen ? 0 : 1,
            pointerEvents: isBottomDockOpen ? 'none' : 'auto',
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
            <span className="font-display text-[11px] font-semibold tracking-tight text-ink/90">
              Workspaces & Widgets
            </span>
            <span className="flex h-4 items-center rounded-full bg-accent/20 px-1.5 text-[9px] font-mono font-bold text-accent">
              {bottomWidgets.length}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
