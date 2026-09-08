import { useMemo, useState } from 'react'
import { CalendarDays, MapPin, ExternalLink, PartyPopper, AlertTriangle, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { ymd } from '@/lib/dates'
import { cn } from '@/utils/cn'

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const DOW_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function timeLabel(ev) {
  if (ev.allDay) return 'All day'
  if (typeof ev.startMin !== 'number') return ''
  const h = Math.floor(ev.startMin / 60)
  const m = ev.startMin % 60
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Month → date grouped list of every synced Google Calendar event (all
 * calendars: primary, holidays, subscribed, shared, plus Gmail-generated
 * flights / tickets / reservations). Read from the local `gcalSlice` cache —
 * no Firestore. This month expanded; later months collapsible.
 */
export function MonthAgenda() {
  const events = useStore((s) => s.gcalEvents)
  const setupError = useStore((s) => s.gcalSetupError)
  const lastSyncAt = useStore((s) => s.gcalLastSyncAt)
  const [collapsed, setCollapsed] = useState({})

  const todayStr = ymd(new Date())
  const thisMonth = monthKey(new Date())

  const months = useMemo(() => {
    const byMonth = new Map()
    const list = (events || [])
      .filter((e) => e.dateStr && e.dateStr >= todayStr.slice(0, 8) + '01') // from the 1st of this month on
      .sort((a, b) => (a.startMs || 0) - (b.startMs || 0))

    for (const ev of list) {
      const d = new Date(ev.startMs)
      const mk = monthKey(d)
      if (!byMonth.has(mk)) byMonth.set(mk, { key: mk, label: MONTH_FMT.format(d), days: new Map() })
      const bucket = byMonth.get(mk)
      if (!bucket.days.has(ev.dateStr)) bucket.days.set(ev.dateStr, { dateStr: ev.dateStr, date: d, items: [] })
      bucket.days.get(ev.dateStr).items.push(ev)
    }
    return [...byMonth.values()].map((m) => ({ ...m, days: [...m.days.values()] }))
  }, [events, todayStr])

  if (setupError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="max-w-sm text-sm text-ink">{setupError.message}</p>
        {setupError.consoleUrl && (
          <a
            href={setupError.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white"
          >
            Open Google Cloud Console <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    )
  }

  if (!months.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted">
        <CalendarDays className="h-8 w-8 opacity-50" />
        <p className="text-sm">
          {lastSyncAt ? 'No upcoming Google Calendar events.' : 'Connect Google Calendar to see your months here.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
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
                {m.days.reduce((n, d) => n + d.items.length, 0)} events
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
                        {day.items.map((ev) => (
                          <a
                            key={ev.id}
                            href={ev.htmlLink || undefined}
                            target={ev.htmlLink ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className="group flex items-start gap-2 rounded-lg border border-line/40 bg-surface/50 px-2.5 py-1.5 transition-colors hover:border-accent/40 hover:bg-surface-2/50"
                          >
                            <span
                              className="mt-1 h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: ev.color }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                {ev.isHoliday && <PartyPopper className="h-3 w-3 shrink-0 text-amber-400" />}
                                <span className="truncate text-xs font-semibold text-ink">{ev.title}</span>
                              </span>
                              <span className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted">
                                <span>{timeLabel(ev)}</span>
                                {ev.location && (
                                  <span className="flex items-center gap-0.5 truncate">
                                    <MapPin className="h-2.5 w-2.5" /> {ev.location}
                                  </span>
                                )}
                                <span className="truncate opacity-70">{ev.calendarName}</span>
                              </span>
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
