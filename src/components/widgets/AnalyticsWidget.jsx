import { lazy, Suspense, useMemo, useState, useEffect } from 'react'
import { Flame, Clock, CalendarCheck, Trophy, Target, Filter } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { WidgetFrame } from './WidgetFrame'
import { Spinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import { ymd, lastNDays } from '@/lib/dates'
import { AnalyticsGoalsModal } from '@/components/analytics/AnalyticsGoalsModal'
import { cn } from '@/utils/cn'

const AnalyticsCharts = lazy(() => import('./AnalyticsCharts'))

const GOALS_STORAGE_KEY = 'protrack:analytics_goals'

function getSavedGoals() {
  if (typeof window === 'undefined') return { focusGoalMin: 120, sessionsGoal: 4 }
  try {
    const raw = localStorage.getItem(GOALS_STORAGE_KEY)
    if (raw) return { focusGoalMin: 120, sessionsGoal: 4, ...JSON.parse(raw) }
  } catch {}
  return { focusGoalMin: 120, sessionsGoal: 4 }
}

function toDate(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  return new Date(ts)
}

export function AnalyticsWidget({ widget, variant }) {
  const stats = useStore((s) => s.stats)
  const modes = useStore((s) => s.modes)
  const { sessions } = useFocusSessions()
  const isHero = variant === 'hero'

  const [dateRange, setDateRange] = useState(14)
  const [selectedModeId, setSelectedModeId] = useState('all')
  const [goals, setGoals] = useState(getSavedGoals)
  const [goalsModalOpen, setGoalsModalOpen] = useState(false)

  const handleSaveGoals = (newGoals) => {
    setGoals(newGoals)
    try {
      localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(newGoals))
    } catch {}
  }

  // Filter sessions by selected mode
  const filteredSessions = useMemo(() => {
    if (selectedModeId === 'all') return sessions
    return sessions.filter((s) => s.modeId === selectedModeId)
  }, [sessions, selectedModeId])

  const perDay = useMemo(() => {
    const days = lastNDays(dateRange)
    const map = Object.fromEntries(days.map((d) => [d.key, 0]))
    filteredSessions.forEach((s) => {
      const d = toDate(s.startedAt)
      if (!d) return
      const key = ymd(d)
      if (key in map) map[key] += s.durationMin || 0
    })
    return days.map((d) => ({ name: d.label, mins: map[d.key] }))
  }, [filteredSessions, dateRange])

  const perHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, mins: 0 }))
    filteredSessions.forEach((s) => {
      const h = s.hourOfDay ?? toDate(s.startedAt)?.getHours()
      if (h != null) buckets[h].mins += s.durationMin || 0
    })
    return buckets.map((b) => ({
      name: b.hour % 3 === 0 ? `${b.hour}` : '',
      mins: b.mins,
    }))
  }, [filteredSessions])

  const today = useMemo(() => {
    const key = ymd()
    let mins = 0
    let count = 0
    filteredSessions.forEach((s) => {
      const d = toDate(s.startedAt)
      if (d && ymd(d) === key) {
        mins += s.durationMin || 0
        count += 1
      }
    })
    return { mins, count }
  }, [filteredSessions])

  const filteredTotalMin = useMemo(() => {
    if (selectedModeId === 'all') return stats?.totalFocusMin || 0
    return filteredSessions.reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }, [filteredSessions, selectedModeId, stats?.totalFocusMin])

  const totalHours = Math.round(((filteredTotalMin || 0) / 60) * 10) / 10

  const activeModes = modes.filter((m) => !m.archived)

  const filterBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/40 bg-surface/40 p-1.5 backdrop-blur-sm">
      {/* Date Range Selector */}
      <div className="flex items-center gap-1 rounded-lg bg-surface/60 p-0.5 border border-line/40 text-xs">
        {[7, 14, 30].map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setDateRange(days)}
            className={cn(
              'rounded-md px-2 py-0.5 font-medium transition-colors cursor-pointer',
              dateRange === days
                ? 'bg-accent/20 text-accent font-bold shadow-sm'
                : 'text-muted hover:text-ink'
            )}
          >
            {days}d
          </button>
        ))}
      </div>

      {/* Mode Filter & Goals Customizer */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-muted">
          <Filter className="h-3 w-3 text-muted" />
          <select
            value={selectedModeId}
            onChange={(e) => setSelectedModeId(e.target.value)}
            className="rounded-lg border border-line/40 bg-surface/70 px-2 py-1 text-xs font-medium text-ink focus:border-accent focus:outline-none cursor-pointer"
            aria-label="Filter analytics by workspace mode"
          >
            <option value="all">All Modes</option>
            {activeModes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setGoalsModalOpen(true)}
          title="Customize daily activity targets"
          aria-label="Customize daily activity targets"
          className="flex h-7 items-center gap-1.5 rounded-lg border border-line/40 bg-surface/70 px-2 text-xs font-medium text-muted hover:text-accent hover:border-accent/40 transition-colors cursor-pointer"
        >
          <Target className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Goals</span>
        </button>
      </div>
    </div>
  )

  // Both normal and hero mode feature vibrant gradient KPI cards
  const cards = (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatCard variant="hero" tone="rose" icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${stats?.currentStreak || 0}d`} />
      <StatCard variant="hero" tone="sky" icon={<CalendarCheck className="h-4 w-4" />} label="Active days" value={stats?.activeDays?.length || 0} />
      <StatCard variant="hero" tone="violet" icon={<Clock className="h-4 w-4" />} label={selectedModeId === 'all' ? "Total focus" : "Mode focus"} value={`${totalHours}h`} />
      <StatCard variant="hero" tone="amber" icon={<Trophy className="h-4 w-4" />} label="Longest session" value={`${stats?.longestSessionMin || 0}m`} />
    </div>
  )

  return (
    <WidgetFrame
      widget={widget}
      variant={variant}
      subtitle={`${stats?.activeDays?.length || 0} active days`}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
        {filterBar}
        {cards}
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          }
        >
          <AnalyticsCharts
            perDay={perDay}
            perHour={perHour}
            today={today}
            stats={stats}
            dateRange={dateRange}
            focusGoalMin={goals.focusGoalMin}
            sessionsGoal={goals.sessionsGoal}
            compact={!isHero}
          />
        </Suspense>

        <AnalyticsGoalsModal
          open={goalsModalOpen}
          onClose={() => setGoalsModalOpen(false)}
          currentGoals={goals}
          onSave={handleSaveGoals}
        />
      </div>
    </WidgetFrame>
  )
}

