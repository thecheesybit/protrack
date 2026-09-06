import { useState, useRef, useCallback } from 'react'
import { LayoutGroup, AnimatePresence, motion } from 'framer-motion'
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
const ALL_SWAPPABLE = ['todos', 'focus', 'habits', 'subjects', 'analytics', 'ledger']

const MINI_META = {
  todos:     { desc: 'Task backlog',         gradient: 'from-sky-500/15 to-blue-500/10' },
  focus:     { desc: 'Deep work sessions',   gradient: 'from-violet-500/15 to-indigo-500/10' },
  habits:    { desc: 'Track daily routines', gradient: 'from-emerald-500/15 to-teal-500/10' },
  subjects:  { desc: 'Study progress',       gradient: 'from-cyan-500/15 to-sky-500/10' },
  analytics: { desc: 'Progress insights',    gradient: 'from-amber-500/15 to-orange-500/10' },
  ledger:    { desc: 'Achievement history',  gradient: 'from-rose-500/15 to-pink-500/10' },
}

// ── Components ────────────────────────────────────────────────────────────────

function Widget({ widget, variant }) {
  const Component = getWidgetComponent(widget.id)
  return <Component widget={widget} variant={variant} />
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
    <motion.button
      layout
      layoutId={`mini-${widget.id}`}
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
      onClick={handleClick}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="edge-light group relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-line/70 bg-surface/60 p-6 backdrop-blur-2xl transition-colors hover:border-accent/50"
    >
      {/* Subtle gradient backdrop */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-70 transition-opacity group-hover:opacity-100',
        meta.gradient,
      )} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent/10 text-accent shadow-glow-sm ring-1 ring-accent/20">
          <Icon className="h-8 w-8" />
        </span>
        <span className="font-display text-xl font-semibold tracking-tight text-ink">{widget.title}</span>
        <span className="text-sm text-muted/85">{meta.desc}</span>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-1/2 h-[3px] w-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-accent to-transparent transition-all duration-300 group-hover:w-3/4" />
    </motion.button>
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

  // ── Maximised: dock + hero ────────────────────────────────────────────────
  if (maximized) {
    return (
      <LayoutGroup>
        <div className="flex h-full gap-3 p-1">
          <div className="flex shrink-0 flex-col gap-2">
            {WIDGETS.map((w) => (
              <DockChip
                key={w.id}
                widget={w}
                isActive={w.id === maximizedWidgetId}
                onClick={() => toggleWidget(w.id)}
              />
            ))}
          </div>
          <motion.div layout className="min-h-0 flex-1">
            <Widget widget={maximized} variant="hero" />
          </motion.div>
        </div>
      </LayoutGroup>
    )
  }

  // ── Default: primary grid + secondary mini cards ──────────────────────────
  return (
    <div className="flex h-full flex-col gap-4 p-1">
      {/* Top row: Timetable (permanent, wider) + Swappable right widget */}
      <div className="flex min-h-0 flex-1 gap-4">
        {leftWidget && (
          <div className="min-h-0 min-w-0 flex-[1.6]">
            <div className="h-full">
              <Widget widget={leftWidget} variant="grid" />
            </div>
          </div>
        )}
        {rightWidget && (
          <motion.div
            key={rightId}
            className="min-h-0 min-w-0 flex-1"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="h-full">
              <Widget widget={rightWidget} variant="grid" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom row: mini-cards — fixed squarish height (no wasted vertical
          space), staggered in on mount for a settled entrance */}
      <motion.div
        className="flex h-56 shrink-0 gap-4"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      >
        {bottomWidgets.map((w) => (
          <MiniCard
            key={w.id}
            widget={w}
            onSingleClick={() => setRightId(w.id)}
            onDoubleClick={() => maximizeWidget(w.id)}
          />
        ))}
      </motion.div>
    </div>
  )
}
