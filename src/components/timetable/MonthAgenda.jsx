import { useMemo, useState } from 'react'
import { CalendarDays, MapPin, ExternalLink, PartyPopper, AlertTriangle, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { ymd } from '@/lib/dates'
import { buildDayTimeline } from '@/lib/dayAgenda'
import { cn } from '@/utils/cn'

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const DOW_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const HORIZON_DAYS = 100 // this month + ~3 ahead

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function timeLabel(item) {
  if (item.allDay || typeof item.startMin !== 'number') return item.kind === 'gcal' && item.allDay ? 'All day' : ''
  const d = new Date()
  d.setHours(Math.floor(item.startMin / 60), item.startMin % 60, 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Month → date "month at a glance". Always shows local items (timetable slots,
 * events, dated to-dos, note deadlines, focus sessions). When Google Calendar
 * is connected it also folds in every synced event (holidays, subscribed,
 * shared, Gmail-generated). This month expanded; later months collapsible.
 */
export function MonthAgenda({
  slots = [],
  events = [],
  todos = [],
  tasks = [],
  noteDeadlines = [],
  sessions = [],
}) {
  const gcalEvents = useStore((s) => s.gcalEvents)
  const setupError = useStore((s) => s.gcalSetupError)
  const [collapsed, setCollapsed] = useState({})

  const todayStr = ymd(new Date())
  const thisMonth = monthKey(new Date())

  const months = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)

    const byMonth = new Map()
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const items = buildDayTimeline({
        slots,
        events,
        todos,
        tasks,
        notes: noteDeadlines,
        sessions,
        gcalEvents,
        date: d,
        carryForward: false,
      }).filter((it) => it.kind !== 'session' || ymd(d) >= todayStr)
      if (!items.length) continue

      const mk = monthKey(d)
      if (!byMonth.has(mk)) byMonth.set(mk, { key: mk, label: MONTH_FMT.format(d), days: [] })
      byMonth.get(mk).days.push({ dateStr: ymd(d), date: new Date(d), items })
    }
    return [...byMonth.values()]
  }, [slots, events, todos, tasks, noteDeadlines, sessions, gcalEvents, todayStr])

  const totalEvents = months.reduce((n, m) => n + m.days.reduce((k, d) => k + d.items.length, 0), 0)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {setupError && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {setupError.message}{' '}
            {setupError.consoleUrl && (
              <a href={setupError.consoleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline">
                Open Console <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
        </div>
      )}

      {!months.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted">
          <CalendarDays className="h-8 w-8 opacity-50" />
          <p className="text-sm">Nothing scheduled in the next few months yet.</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted">
            {totalEvents} item{totalEvents === 1 ? '' : 's'} · {gcalEvents?.length ? 'Google Calendar connected' : 'connect Google Calendar to add holidays & shared calendars'}
          </p>
          {months.map((m) => {
            const isThis = m.key === thisMonth
            const open = isThis ? true : !collapsed[m.key]
            return (
              <section key={m.key}>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [m.key]: !c[m.key] }))}
                  disabled={isThis}
                  className="mb-2 flex w-full items-center justify-between border-b border-line/50 pb-1.5 text-left"
                >
                  <span className="text-sm font-bold text-ink">{m.label}</span>
                  <span className="flex items-center gap-2 text-[11px] text-muted">
                    {m.days.reduce((n, d) => n + d.items.length, 0)} items
                    {!isThis && <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />}
                  </span>
                </button>

                {open && (
                  <div className="flex flex-col gap-2.5">
                    {m.days.map((day) => {
                      const isToday = day.dateStr === todayStr
                      return (
                        <div key={day.dateStr} className="flex gap-3">
                          <div
                            className={cn(
                              'flex w-11 shrink-0 flex-col items-center rounded-xl border py-1',
                              isToday
                                ? 'border-accent/60 bg-accent/10 text-accent'
                                : 'border-line/50 bg-surface-2/30 text-muted',
                            )}
                          >
                            <span className="text-[9px] font-semibold uppercase">{DOW_FMT.format(day.date)}</span>
                            <span className="text-base font-black leading-none text-ink">{day.date.getDate()}</span>
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            {day.items.map((it) => {
                              const g = it.kind === 'gcal' ? it.ref : null
                              const Wrapper = g?.htmlLink ? 'a' : 'div'
                              return (
                                <Wrapper
                                  key={it.id}
                                  {...(g?.htmlLink ? { href: g.htmlLink, target: '_blank', rel: 'noopener noreferrer' } : {})}
                                  className="group flex items-start gap-2 rounded-lg border border-line/40 bg-surface/50 px-2.5 py-1.5 transition-colors hover:border-accent/40 hover:bg-surface-2/50"
                                >
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
                                  <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5">
                                      {g?.isHoliday && <PartyPopper className="h-3 w-3 shrink-0 text-amber-400" />}
                                      <span className={cn('truncate text-xs font-semibold text-ink', it.done && 'line-through opacity-60')}>
                                        {it.title}
                                      </span>
                                    </span>
                                    <span className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted">
                                      <span>{timeLabel(it)}</span>
                                      {g?.location && (
                                        <span className="flex items-center gap-0.5 truncate">
                                          <MapPin className="h-2.5 w-2.5" /> {g.location}
                                        </span>
                                      )}
                                      <span className="truncate capitalize opacity-70">
                                        {g ? g.calendarName : it.kind}
                                      </span>
                                    </span>
                                  </span>
                                </Wrapper>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
