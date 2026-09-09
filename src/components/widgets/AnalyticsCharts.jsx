import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { HealthRings } from '@/components/analytics/HealthRings'
import { cn } from '@/utils/cn'

const ACCENT = 'rgb(var(--accent, 99 102 241))'

const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--line, 218 213 205 / 0.4))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--text))',
}

function Chart({ title, data, headerExtra }) {
  return (
    <div className="flex min-h-[150px] flex-1 flex-col rounded-2xl border border-line/50 bg-surface-2/30 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{title}</span>
        {headerExtra}
      </div>
      <div className="min-h-0 flex-1 w-full" style={{ minHeight: 110 }}>
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

export default function AnalyticsCharts({
  perDay,
  perHour,
  today,
  stats,
  dateRange = 14,
  focusGoalMin = 120,
  sessionsGoal = 4,
  compact = false,
}) {
  const [activeTab, setActiveTab] = useState('daily')

  if (compact) {
    const tabButtons = (
      <div className="flex items-center gap-1 rounded-lg bg-surface/60 p-0.5 border border-line/40 text-[10px]">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={cn(
            'rounded-md px-2 py-0.5 font-medium transition-colors',
            activeTab === 'daily' ? 'bg-accent/20 text-accent font-bold' : 'text-muted hover:text-ink'
          )}
        >
          {dateRange} Days
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hourly')}
          className={cn(
            'rounded-md px-2 py-0.5 font-medium transition-colors',
            activeTab === 'hourly' ? 'bg-accent/20 text-accent font-bold' : 'text-muted hover:text-ink'
          )}
        >
          Peak Hours
        </button>
      </div>
    )

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
        <div className="flex shrink-0 items-center justify-center rounded-2xl border border-line/50 bg-surface-2/30 p-3">
          <HealthRings
            todayMins={today.mins}
            streak={stats?.currentStreak || 0}
            sessionsToday={today.count}
            focusGoalMin={focusGoalMin}
            sessionsGoal={sessionsGoal}
            size={135}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <Chart
            title={activeTab === 'daily' ? `Focus minutes · last ${dateRange} days` : 'Peak focus hours'}
            data={activeTab === 'daily' ? perDay : perHour}
            headerExtra={tabButtons}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
      <div className="flex shrink-0 items-center justify-center rounded-2xl border border-line/50 bg-surface-2/30 p-4 xl:w-64">
        <HealthRings
          todayMins={today.mins}
          streak={stats?.currentStreak || 0}
          sessionsToday={today.count}
          focusGoalMin={focusGoalMin}
          sessionsGoal={sessionsGoal}
          size={168}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <Chart title={`Focus minutes · last ${dateRange} days`} data={perDay} />
        <Chart title="Peak focus hours" data={perHour} />
      </div>
    </div>
  )
}
