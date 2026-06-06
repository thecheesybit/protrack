import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Flame, Clock, CalendarCheck, Trophy } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { WidgetFrame } from './WidgetFrame'
import { ymd, lastNDays } from '@/lib/dates'

const ACCENT = '#818cf8'

const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--text))',
}

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

  const totalHours = Math.round(((stats?.totalFocusMin || 0) / 60) * 10) / 10

  const cards = (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Stat icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${stats?.currentStreak || 0}d`} />
      <Stat icon={<CalendarCheck className="h-4 w-4" />} label="Active days" value={stats?.activeDays?.length || 0} />
      <Stat icon={<Clock className="h-4 w-4" />} label="Total focus" value={`${totalHours}h`} />
      <Stat icon={<Trophy className="h-4 w-4" />} label="Longest session" value={`${stats?.longestSessionMin || 0}m`} />
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
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <Chart title="Focus minutes · last 14 days" data={perDay} />
            <Chart title="Peak focus hours" data={perHour} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          {cards}
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--surface-2))' }} />
                <Bar dataKey="mins" radius={[4, 4, 0, 0]} fill={ACCENT} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </WidgetFrame>
  )
}

function Chart({ title, data }) {
  return (
    <div className="flex min-h-0 flex-col rounded-2xl border border-line/50 bg-surface-2/30 p-3">
      <span className="mb-2 text-xs font-medium text-muted">{title}</span>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--surface-2))' }} />
            <Bar dataKey="mins" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={ACCENT} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="truncate text-[11px] text-muted">{label}</div>
      </div>
    </div>
  )
}
