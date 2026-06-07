// Recharts-heavy hero view — loaded lazily only when analytics is maximized.
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

const ACCENT = '#818cf8'

const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 10,
  fontSize: 12,
  color: 'rgb(var(--text))',
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

export default function AnalyticsCharts({ perDay, perHour, today, stats }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
      <div className="flex shrink-0 items-center justify-center rounded-2xl border border-line/50 bg-surface-2/30 p-4 xl:w-64">
        <HealthRings
          todayMins={today.mins}
          streak={stats?.currentStreak || 0}
          sessionsToday={today.count}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <Chart title="Focus minutes · last 14 days" data={perDay} />
        <Chart title="Peak focus hours" data={perHour} />
      </div>
    </div>
  )
}
