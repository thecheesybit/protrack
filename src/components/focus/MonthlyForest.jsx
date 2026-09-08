import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Sprout, TreePine } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SpriteTree } from './ForestSprites'

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
  if (count < 20) return `${count} trees this month — this is becoming a real forest.`
  if (count < 40) return `${count} trees. A dense, thriving canopy. Outstanding month.`
  return `${count} trees — a whole woodland grown from your focus. Remarkable.`
}

/**
 * The month's forest: one hand-drawn tree per successful focus session in the
 * selected calendar month, with a month switcher and a motivating summary.
 */
export function MonthlyForest({ sessions = [], compact = false }) {
  const [monthOffset, setMonthOffset] = useState(0)

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

  // Trees shrink + overlap more as the grove grows, so a big month still fits.
  const baseH = Math.max(compact ? 34 : 44, Math.min(compact ? 60 : 84, 96 - Math.min(count, 30) * 1.9))
  const overlap = count > 14 ? -Math.round(baseH * 0.32) : count > 7 ? -Math.round(baseH * 0.18) : 4

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Month switcher + counts */}
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
        <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
          <TreePine className="h-3 w-3" />
          {count}
        </span>
      </div>

      {/* The grove */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl border border-white/5 bg-gradient-to-b from-black/10 to-emerald-950/25 p-3">
        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sprout className="h-8 w-8 text-emerald-400/80" />
            </motion.span>
            <span className="max-w-[220px] text-[11px] leading-relaxed text-white/55">
              {encouragement(0, isCurrentMonth)}
            </span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${year}-${month}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap items-end gap-y-1"
            >
              {monthSessions.map((s, i) => (
                <div
                  key={s.id || `${year}-${month}-${i}`}
                  style={{ marginLeft: i === 0 ? 0 : overlap, zIndex: i % 2 ? 5 : 6 }}
                  title={`${Number(s.durationMin) || 25}m focus · ${
                    toDate(s.startedAt || s.createdAt)?.toLocaleDateString([], {
                      day: 'numeric',
                      month: 'short',
                    }) || ''
                  }`}
                  className="transition-transform hover:-translate-y-1"
                >
                  <SpriteTree
                    species={speciesFor(s, i)}
                    variant={i}
                    height={baseH * (i % 3 === 1 ? 1.08 : i % 3 === 2 ? 0.92 : 1)}
                    delay={Math.min(0.4, i * 0.02)}
                  />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
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
  )
}
