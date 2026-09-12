import { useMemo, useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Sprout,
  TreePine,
  Maximize2,
  X,
  Clock,
  Sparkles,
  Flower2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SpriteFoliage, getSessionFoliageSeed, formatFloraBreakdown } from './ForestSprites'
import { getPlantType } from './CalendarForest'

/**
 * Calculates a natural 2.5D scatter coordinate on the forest soil patch (Area A).
 * Distributes plants across width (12-88%) and depth tiers (8-42% bottom),
 * with realistic perspective depth scaling and z-index ordering.
 */
function getPatchScatter(session, index, total) {
  const seed = getSessionFoliageSeed(session, index)
  if (total === 1) {
    return { leftPct: 50, bottomPct: 18, depthScale: 1.05, z: 20 }
  }
  const phi = 0.618033988749895
  const rawX = ((index * phi + ((seed % 23) / 23) * 0.15) % 1)
  const leftPct = 12 + rawX * 76

  // 3 stratified depth tiers: back (34%), mid (22%), foreground (10%)
  const tier = index % 3
  const baseBottom = tier === 0 ? 34 : tier === 1 ? 22 : 10
  const jitterY = (((seed >> 2) % 9) - 4) * 1.5 // -6% to +6%
  const bottomPct = Math.max(8, Math.min(42, baseBottom + jitterY))

  // Perspective depth scale: deeper into the clearing = slightly smaller
  const depthScale = 0.85 + ((42 - bottomPct) / 34) * 0.35 // 0.85 to 1.2
  const z = 10 + Math.round((42 - bottomPct) * 2)

  return { leftPct, bottomPct, depthScale, z }
}

function toDate(ts) {
  if (!ts) return null
  try {
    if (typeof ts.toDate === 'function') return ts.toDate()
    const d = new Date(ts)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

/** Successful sessions only — mirrors CalendarForest's day filter, month-wide. */
function successfulSessionsInMonth(sessions, year, month) {
  return (sessions || [])
    .filter((s) => {
      if (!s || s.completed === false || s.failedReason) return false
      if (s.durationMin !== undefined && s.durationMin <= 0) return false
      const d = toDate(s.startedAt || s.createdAt)
      return d && d.getFullYear() === year && d.getMonth() === month
    })
    .sort((a, b) => {
      const ta = toDate(a.startedAt || a.createdAt)?.getTime() || 0
      const tb = toDate(b.startedAt || b.createdAt)?.getTime() || 0
      return ta - tb
    })
}

/** All successful sessions across entire history. */
function allSuccessfulSessions(sessions) {
  return (sessions || [])
    .filter((s) => {
      if (!s || s.completed === false || s.failedReason) return false
      if (s.durationMin !== undefined && s.durationMin <= 0) return false
      const d = toDate(s.startedAt || s.createdAt)
      return d && !isNaN(d.getTime())
    })
    .sort((a, b) => {
      const ta = toDate(a.startedAt || a.createdAt)?.getTime() || 0
      const tb = toDate(b.startedAt || b.createdAt)?.getTime() || 0
      return ta - tb
    })
}

const SPECIES_CYCLE = ['oak', 'pine', 'blossom', 'oak', 'pine']

function speciesFor(session, idx) {
  const dur = Number(session?.durationMin) || 0
  if (dur >= 50) return idx % 2 === 0 ? 'oak' : 'pine'
  return SPECIES_CYCLE[idx % SPECIES_CYCLE.length]
}

/** Warm, rotating line of encouragement keyed to how full the month is. */
function encouragement(count, isCurrentMonth) {
  if (count === 0) {
    return isCurrentMonth
      ? 'Your forest floor is bare. Finish one session to plant the first tree.'
      : 'No trees took root this month.'
  }
  if (count < 4) return 'A few saplings are in. Keep going — the grove is starting.'
  if (count < 10) return 'The grove is filling out. Every session adds a trunk.'
  if (count < 20) return `${count} plants this month — this is becoming a real forest.`
  if (count < 40) return `${count} plants. A dense, thriving canopy. Outstanding month.`
  return `${count} plants — a whole woodland grown from your focus. Remarkable.`
}

/**
 * Full-Screen Forest Modal: Immersive landscape sanctuary displaying the complete
 * ecosystem of Trees (15+m), Shrubs (10-15m), and Flowers (<10m) with live tooltips.
 */
export function FullScreenForestModal({ sessions = [], initialMonthOffset = 0, onClose }) {
  const [viewScope, setViewScope] = useState('month') // 'month' | 'all'
  const [monthOffset, setMonthOffset] = useState(initialMonthOffset)
  const [hoveredItem, setHoveredItem] = useState(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const { year, month, label } = useMemo(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString([], { month: 'long', year: 'numeric' }),
    }
  }, [monthOffset])

  const displayedSessions = useMemo(() => {
    if (viewScope === 'all') return allSuccessfulSessions(sessions)
    return successfulSessionsInMonth(sessions, year, month)
  }, [sessions, viewScope, year, month])

  const totalMin = useMemo(
    () => displayedSessions.reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0),
    [displayedSessions],
  )

  const countsByType = useMemo(() => {
    const c = { flower: 0, shrub: 0, tree: 0 }
    for (const s of displayedSessions) {
      const p = getPlantType(s)
      c[p] = (c[p] || 0) + 1
    }
    return c
  }, [displayedSessions])

  const totalCount = displayedSessions.length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-2xl select-none"
    >
      {/* ── Top Header Bar ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 shadow-glow">
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Focus Forest Sanctuary</h2>
            <p className="text-xs text-muted">
              Every focus session is grounded as living flora
            </p>
          </div>
        </div>

        {/* View Scope & Month Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-1">
            <button
              onClick={() => setViewScope('month')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                viewScope === 'month'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewScope('all')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                viewScope === 'all'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {viewScope === 'month' && (
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 px-2 py-1">
              <button
                type="button"
                onClick={() => setMonthOffset((o) => o - 1)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-white/60 hover:text-white transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[110px] text-center text-xs font-bold text-white">
                {label}
              </span>
              <button
                type="button"
                disabled={monthOffset >= 0}
                onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-white/60 hover:text-white transition-colors disabled:opacity-30"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Flora Breakdown Pill Badges ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-black/20 px-6 py-2.5 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
            <TreePine className="h-4 w-4 text-emerald-400" />
            <span>{countsByType.tree} Trees</span>
            <span className="text-[10px] text-muted">(15+ min)</span>
          </div>
          <span className="text-white/20">·</span>
          <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
            <Sprout className="h-4 w-4 text-teal-400" />
            <span>{countsByType.shrub} Shrubs</span>
            <span className="text-[10px] text-muted">(10–15 min)</span>
          </div>
          <span className="text-white/20">·</span>
          <div className="flex items-center gap-1.5 text-pink-300 font-semibold">
            <Flower2 className="h-4 w-4 text-pink-400" />
            <span>{countsByType.flower} Flowers</span>
            <span className="text-[10px] text-muted">(&lt; 10 min)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted">
          <Clock className="h-3.5 w-3.5 text-accent" />
          <span>
            {Math.round(totalMin / 60)}h {totalMin % 60}m focused across {totalCount} planted specimens
          </span>
        </div>
      </div>

      {/* ── Meadow Canvas (Full Immersion) ── */}
      <div className="relative flex flex-1 flex-col items-center justify-end overflow-hidden p-6 sm:p-12 bg-gradient-to-b from-slate-950 via-emerald-950/20 to-emerald-950/60">
        {/* Atmospheric Glow */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-emerald-500/10 to-transparent" />

        {/* Floating Tooltip */}
        <AnimatePresence>
          {hoveredItem && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-8 z-50 rounded-2xl border border-emerald-500/30 bg-slate-950/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl text-center"
            >
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400">
                <Sparkles className="h-3 w-3" />
                <span>{hoveredItem.title}</span>
              </div>
              <p className="text-[11px] text-white/80 mt-0.5">{hoveredItem.detail}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {totalCount === 0 ? (
          <div className="my-auto flex flex-col items-center justify-center gap-3 text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sprout className="h-16 w-16 text-emerald-400/60" />
            </motion.div>
            <h3 className="text-base font-bold text-white">Your Meadow Awaits</h3>
            <p className="max-w-md text-xs text-muted leading-relaxed">
              No plants have taken root here yet. Start a focus session to plant your first flower, shrub, or tree!
            </p>
          </div>
        ) : (
          <div className="relative flex w-full max-w-6xl flex-wrap items-end justify-center pb-2 overflow-visible">
            {displayedSessions.map((s, i) => {
              const pType = getPlantType(s)
              const pHeight =
                pType === 'flower'
                  ? 48
                  : pType === 'shrub'
                  ? 72
                  : 120

              const dur = Number(s.durationMin) || 25
              const d = toDate(s.startedAt || s.createdAt)
              const dateText = d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
              const timeText = d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
              const label = s.label || s.title || (s.modeId ? `${s.modeId} session` : null)
              const plantLabel = pType === 'flower' ? 'Flower' : pType === 'shrub' ? 'Shrub' : 'Tree'

              const tooltip = {
                title: `${dur}m ${dur >= 50 ? 'Deep Focus' : 'Focus'} · ${plantLabel}`,
                detail: label
                  ? `${label} · Completed ${dateText} at ${timeText}`
                  : `Completed ${dateText} at ${timeText}`,
              }

              return (
                <div
                  key={s.id || `full-${i}`}
                  style={{
                    margin: '0 4px',
                    zIndex: pType === 'flower' ? 30 : pType === 'shrub' ? 20 : 10,
                  }}
                  className="cursor-pointer transition-all duration-200 hover:scale-120 hover:drop-shadow-[0_0_12px_rgba(52,211,153,0.6)] active:scale-95"
                  onMouseEnter={() => setHoveredItem(tooltip)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <SpriteFoliage
                    type={pType}
                    species="all"
                    variant={getSessionFoliageSeed(s, i)}
                    height={pHeight}
                    delay={Math.min(0.5, i * 0.02)}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* ── Soil & Grassy Meadow Baseline ── */}
        <div className="relative w-full max-w-6xl h-2 rounded-full overflow-hidden mt-2">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900 via-emerald-600 to-emerald-900 opacity-70" />
          <div className="absolute inset-x-0 bottom-0 h-1 bg-emerald-400/40 blur-[1px]" />
        </div>
      </div>
    </motion.div>
  )
}

/**
 * The month's forest: one hand-drawn tree per successful focus session in the
 * selected calendar month, with a month switcher and a motivating summary.
 */
export function MonthlyForest({ sessions = [] }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [hoveredSession, setHoveredSession] = useState(null)

  const { year, month, label, isCurrentMonth } = useMemo(() => {
    const now = new Date()
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString([], { month: 'long', year: 'numeric' }),
      isCurrentMonth: monthOffset === 0,
    }
  }, [monthOffset])

  const monthSessions = useMemo(
    () => successfulSessionsInMonth(sessions, year, month),
    [sessions, year, month],
  )

  const count = monthSessions.length
  const totalMin = useMemo(
    () => monthSessions.reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0),
    [monthSessions],
  )
  const activeDays = useMemo(
    () => new Set(monthSessions.map((s) => toDate(s.startedAt || s.createdAt)?.getDate())).size,
    [monthSessions],
  )

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Month switcher + counts + Expand Full Screen */}
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthOffset((o) => o - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:text-white"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-bold tracking-tight text-white/90">{label}</span>
          <button
            type="button"
            disabled={monthOffset >= 0}
            onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:text-white disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
              <TreePine className="h-3 w-3" />
              {count > 0 ? formatFloraBreakdown(monthSessions) : '0 trees'}
            </span>
            <button
              type="button"
              onClick={() => setIsFullScreen(true)}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:text-white hover:border-emerald-500/30"
              title="Expand full-screen forest sanctuary"
              aria-label="Expand full-screen forest"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* ── Area A: Organic Forest Patch of Soil ── */}
        <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-[#0b130e] via-[#141b12] to-[#120c07] p-3 shadow-[inset_0_0_35px_rgba(0,0,0,0.6)] select-none flex flex-col justify-end">
          {/* Soil patch terrain texture & depth gradients */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0e0a06] via-[#1a140d]/90 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 border-b border-amber-900/40" />
          {/* Earthy moss and grassy clearing glows */}
          <div className="pointer-events-none absolute bottom-5 left-8 h-16 w-52 rounded-full bg-emerald-600/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-8 right-10 h-16 w-56 rounded-full bg-emerald-500/10 blur-2xl" />
          {/* Atmospheric ambient spores / fireflies */}
          <div className="pointer-events-none absolute top-1/4 left-1/4 h-1.5 w-1.5 rounded-full bg-amber-300/40 blur-[0.5px] animate-pulse" />
          <div className="pointer-events-none absolute top-1/3 right-1/3 h-2 w-2 rounded-full bg-emerald-300/30 blur-[0.5px] animate-pulse" style={{ animationDelay: '2s' }} />

          {/* Hover inspection card */}
          <AnimatePresence>
            {hoveredSession && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap rounded-xl border border-emerald-500/30 bg-slate-950/92 px-3 py-1.5 shadow-2xl backdrop-blur-xl text-center"
              >
                <p className="text-xs font-bold text-emerald-400">
                  {hoveredSession.label || hoveredSession.title || 'Focus Session'}
                </p>
                <p className="text-[10px] text-white/70 mt-0.5">
                  {Number(hoveredSession.durationMin) || 25}m {getPlantType(hoveredSession)} · {toDate(hoveredSession.startedAt || hoveredSession.createdAt)?.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {count === 0 ? (
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2.5 text-center my-auto">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              >
                <Sprout className="h-6 w-6" />
              </motion.div>
              <h4 className="text-xs font-bold text-white/90">Freshly Tilled Soil Bed</h4>
              <span className="max-w-[240px] text-[11px] leading-relaxed text-white/55">
                {encouragement(0, isCurrentMonth)}
              </span>
            </div>
          ) : (
            <div className="relative h-full w-full min-h-[260px]">
              {monthSessions.map((s, i) => {
                const pType = getPlantType(s)
                const seed = getSessionFoliageSeed(s, i)
                const { leftPct, bottomPct, depthScale, z } = getPatchScatter(s, i, count)

                const pHeight =
                  pType === 'flower'
                    ? Math.round(38 * depthScale)
                    : pType === 'shrub'
                    ? Math.round(52 * depthScale)
                    : Math.round(86 * depthScale)

                return (
                  <div
                    key={s.id || `${year}-${month}-${i}`}
                    className="absolute cursor-pointer transition-transform duration-200 hover:scale-115 hover:-translate-y-1.5 active:scale-95 group"
                    style={{
                      left: `${leftPct}%`,
                      bottom: `${bottomPct}%`,
                      transform: 'translateX(-50%)',
                      zIndex: z,
                    }}
                    onMouseEnter={() => setHoveredSession(s)}
                    onMouseLeave={() => setHoveredSession(null)}
                  >
                    {/* Organic soil shadow beneath root */}
                    <div
                      className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/65 blur-[2px] transition-all group-hover:scale-110"
                      style={{
                        width: pType === 'flower' ? '28px' : pType === 'shrub' ? '42px' : '58px',
                        height: pType === 'flower' ? '6px' : pType === 'shrub' ? '8px' : '10px',
                      }}
                    />
                    <SpriteFoliage
                      type={pType}
                      species={speciesFor(s, i)}
                      variant={seed}
                      height={pHeight}
                      delay={Math.min(0.35, i * 0.02)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Motivating summary */}
        <div className="mt-2 space-y-1">
          <p className="text-[11px] leading-snug text-emerald-300/90">
            {encouragement(count, isCurrentMonth)}
          </p>
          {count > 0 && (
            <p className="text-[10px] text-white/45">
              {Math.round(totalMin / 60)}h {totalMin % 60}m focused across {activeDays} day
              {activeDays === 1 ? '' : 's'} this month.
            </p>
          )}
        </div>
      </div>

      {/* ── Full-Screen Forest Modal Overlay ── */}
      <AnimatePresence>
        {isFullScreen && (
          <FullScreenForestModal
            sessions={sessions}
            initialMonthOffset={monthOffset}
            onClose={() => setIsFullScreen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

