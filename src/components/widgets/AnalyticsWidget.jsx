import { lazy, Suspense, useMemo } from 'react'
import { Flame, Clock, CalendarCheck, Trophy } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { WidgetFrame } from './WidgetFrame'
import { Spinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import { ymd, lastNDays } from '@/lib/dates'

const AnalyticsCharts = lazy(() => import('./AnalyticsCharts'))

function toDate(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  return new Date(ts)
}

export function AnalyticsWidget({ widget, variant }) {
  const stats = useStore((s) => s.stats)
  const { sessions } = useFocusSessions()
  const isHero = variant === 'hero'

  const perDay = useMemo(() => {
    const days = lastNDays(14)
    const map = Object.fromEntries(days.map((d) => [d.key, 0]))
    sessions.forEach((s) => {
      const d = toDate(s.startedAt)
      if (!d) return
      const key = ymd(d)
      if (key in map) map[key] += s.durationMin || 0
    })
    return days.map((d) => ({ name: d.label, mins: map[d.key] }))
  }, [sessions])

  const perHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, mins: 0 }))
    sessions.forEach((s) => {
      const h = s.hourOfDay ?? toDate(s.startedAt)?.getHours()
      if (h != null) buckets[h].mins += s.durationMin || 0
    })
    return buckets.map((b) => ({
      name: b.hour % 3 === 0 ? `${b.hour}` : '',
      mins: b.mins,
    }))
  }, [sessions])

  const today = useMemo(() => {
    const key = ymd()
    let mins = 0
    let count = 0
    sessions.forEach((s) => {
      const d = toDate(s.startedAt)
      if (d && ymd(d) === key) {
        mins += s.durationMin || 0
        count += 1
      }
    })
    return { mins, count }
  }, [sessions])

  const totalHours = Math.round(((stats?.totalFocusMin || 0) / 60) * 10) / 10

  // Hero mode earns the full-bleed gradient KPI cards; the grid stays compact.
  const statVariant = isHero ? 'hero' : 'compact'
  const cards = (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <StatCard variant={statVariant} tone="rose" icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${stats?.currentStreak || 0}d`} />
      <StatCard variant={statVariant} tone="sky" icon={<CalendarCheck className="h-4 w-4" />} label="Active days" value={stats?.activeDays?.length || 0} />
      <StatCard variant={statVariant} tone="violet" icon={<Clock className="h-4 w-4" />} label="Total focus" value={`${totalHours}h`} />
      <StatCard variant={statVariant} tone="amber" icon={<Trophy className="h-4 w-4" />} label="Longest session" value={`${stats?.longestSessionMin || 0}m`} />
    </div>
  )

  return (
    <WidgetFrame
      widget={widget}
      variant={variant}
      subtitle={`${stats?.activeDays?.length || 0} active days`}
    >
      {isHero ? (
        <div className="flex h-full flex-col gap-4">
          {cards}
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center">
                <Spinner className="h-6 w-6" />
              </div>
            }
          >
            <AnalyticsCharts perDay={perDay} perHour={perHour} today={today} stats={stats} />
          </Suspense>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          {cards}
          <p className="mt-auto text-center text-[10px] text-muted/70">Maximize for charts</p>
        </div>
      )}
    </WidgetFrame>
  )
}

