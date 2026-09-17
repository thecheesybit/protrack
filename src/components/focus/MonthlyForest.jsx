import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Sprout, TreePine, Globe, Sparkles } from 'lucide-react'
import { getSessionFoliageSeed, formatFloraBreakdown } from './ForestSprites'
import { getPlantType } from './CalendarForest'
import { ForestTerrain } from './ForestTerrain'
import { ForestWorldMap } from './ForestWorldMap'
import { deriveMonthEcosystem } from '@/lib/ecosystem'
import { loadMonthRollups, sealMonth } from '@/lib/ecoRollup'

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

/** Build isometric-terrain items (oldest first) with rich hover tooltips. */
function monthItems(monthSessions) {
  return monthSessions.map((s, i) => {
    const type = getPlantType(s)
    const dur = Number(s.durationMin) || 25
    const when = toDate(s.startedAt || s.createdAt)
    return {
      key: s.id || `mf-${i}`,
      type,
      species: 'all',
      seed: getSessionFoliageSeed(s, i),
      session: s,
      tooltip: {
        title: s.label || s.title || 'Focus Session',
        detail: `${dur}m ${type}${when ? ` · ${when.toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}`,
      },
    }
  })
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
 * The month's forest: a 2.5D isometric plot with one plant per successful focus
 * session in the selected calendar month, a month switcher, and a motivating
 * summary.
 */
export function MonthlyForest({ sessions = [], currentStreak = 0, streak = 0 }) {
  const [monthOffset, setMonthOffset] = useState(0)
  const [viewMode, setViewMode] = useState('hex') // 'hex' | 'world'

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
  const items = useMemo(() => monthItems(monthSessions), [monthSessions])

  const count = monthSessions.length
  const totalMin = useMemo(
    () => monthSessions.reduce((acc, s) => acc + (Number(s.durationMin) || 0), 0),
    [monthSessions],
  )
  const activeDays = useMemo(
    () => new Set(monthSessions.map((s) => toDate(s.startedAt || s.createdAt)?.getDate())).size,
    [monthSessions],
  )

  // Check permanent sealed rollup for historical months
  const sealedRollup = useMemo(() => {
    if (monthOffset >= 0) return null
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
    const rollups = loadMonthRollups()
    if (rollups[monthKey]) return rollups[monthKey]

    // If past month has sessions but wasn't sealed yet, seal it now
    if (monthSessions.length > 0) {
      return sealMonth({
        year,
        month,
        totalMin,
        activeDays,
        monthSessions,
      })
    }
    return null
  }, [monthOffset, year, month, monthSessions, totalMin, activeDays])

  // Pure ecosystem derivation for the selected month (uses sealed rollup when available)
  const ecosystem = useMemo(() => {
    if (sealedRollup?.ecosystem) {
      return sealedRollup.ecosystem
    }

    const isSealed = monthOffset < 0
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysElapsed = isCurrentMonth ? Math.min(daysInMonth, new Date().getDate()) : daysInMonth
    const lastSession = monthSessions[monthSessions.length - 1]
    const lastDate = lastSession ? toDate(lastSession.startedAt || lastSession.createdAt) : null
    const daysSinceLast = lastDate
      ? Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / 86400000))
      : isCurrentMonth
      ? new Date().getDate()
      : 30

    const effectiveStreak = isCurrentMonth ? (currentStreak || streak || 0) : 0

    return deriveMonthEcosystem({
      totalMin,
      activeDays,
      daysElapsed,
      daysSinceLast,
      currentStreak: effectiveStreak,
      month,
      year,
      isSealed,
    })
  }, [sealedRollup, monthSessions, totalMin, activeDays, isCurrentMonth, monthOffset, year, month, currentStreak, streak])

  // Preserved items from rollups if sessions dropped out of sliding 300 window
  const displayItems = useMemo(() => {
    if (items.length > 0) return items
    if (sealedRollup?.miniItems?.length > 0) {
      return sealedRollup.miniItems.map((m, idx) => ({
        key: `rollup-${idx}`,
        type: m.type,
        species: 'all',
        seed: m.seed || idx * 7,
        tooltip: {
          title: 'Sealed Historical Flora',
          detail: `${m.type} from preserved month rollup`,
        },
      }))
    }
    return []
  }, [items, sealedRollup])

  const displayCount = items.length > 0 ? count : (sealedRollup?.counts?.total ?? 0)
  const displayMin = totalMin > 0 ? totalMin : (sealedRollup?.totalMin ?? 0)
  const displayActiveDays = activeDays > 0 ? activeDays : (sealedRollup?.activeDays ?? 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Month switcher + counts + View Mode toggle */}
      <div className="mb-2 flex items-center gap-2">
        {viewMode === 'hex' ? (
          <>
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o - 1)}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:text-white cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-bold tracking-tight text-white/90">{label}</span>
            <button
              type="button"
              disabled={monthOffset >= 0}
              onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-white/60 transition-colors hover:text-white disabled:opacity-30 cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="text-xs font-bold tracking-tight text-white/90 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-emerald-400" />
            Honeycomb World Continent
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {viewMode === 'hex' && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
              <TreePine className="h-3 w-3" />
              {displayCount > 0 ? (items.length > 0 ? formatFloraBreakdown(monthSessions) : `${displayCount} flora`) : '0 trees'}
            </span>
          )}

          {/* Hex / World continent switcher pill */}
          <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('hex')}
              className={`flex items-center gap-1 rounded-lg px-2 py-0.5 transition-all cursor-pointer ${
                viewMode === 'hex'
                  ? 'bg-emerald-500/25 text-emerald-300 font-bold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <TreePine className="h-3 w-3" />
              <span>Month Forest</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('world')}
              className={`flex items-center gap-1 rounded-lg px-2 py-0.5 transition-all cursor-pointer ${
                viewMode === 'world'
                  ? 'bg-emerald-500/25 text-emerald-300 font-bold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Globe className="h-3 w-3" />
              <span>World Map</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'world' ? (
        <ForestWorldMap
          sessions={sessions}
          currentStreak={currentStreak || streak || 0}
          className="min-h-[340px]"
          onInspectMonth={(hex) => {
            // Find monthOffset for this hex
            const now = new Date()
            const offset = (hex.year - now.getFullYear()) * 12 + (hex.month - now.getMonth())
            setMonthOffset(offset)
            setViewMode('hex')
          }}
        />
      ) : (
        <>
          {/* ── 2.5D Living Isometric Rhombus Diorama ── */}
          <ForestTerrain
            items={displayItems}
            minHeightClass="min-h-[300px]"
            ecosystem={ecosystem}
            isHex={false}
            emptyState={
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <Sprout className="h-6 w-6" />
                </div>
                <h4 className="text-xs font-bold text-white/90">Freshly Tilled Soil Bed</h4>
                <span className="max-w-[240px] text-[11px] leading-relaxed text-white/55">
                  {encouragement(0, isCurrentMonth)}
                </span>
              </>
            }
          />

          {/* Motivating summary & Next Tier Progression */}
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] leading-snug text-emerald-300/90">
              {encouragement(displayCount, isCurrentMonth)}
            </p>
            {displayCount > 0 && (
              <p className="text-[10px] text-white/45">
                {Math.round(displayMin / 60)}h {displayMin % 60}m focused across {displayActiveDays} day
                {displayActiveDays === 1 ? '' : 's'} this month · {ecosystem?.hydrology?.name || 'Meadow'}
              </p>
            )}
            {isCurrentMonth && ecosystem?.nextTier?.hintText && ecosystem?.tier?.level < 5 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] text-emerald-300 font-medium">
                <Sparkles className="h-3 w-3 text-emerald-400 shrink-0" />
                <span>Next: {ecosystem.nextTier.hintText}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
