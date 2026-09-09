import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { ymd } from '@/lib/dates'
import { buildDayTimeline } from '@/lib/dayAgenda'
import { cn } from '@/utils/cn'

const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const back = (first.getDay() + 6) % 7 // Monday-start
  const start = new Date(first)
  start.setDate(first.getDate() - back)
  start.setHours(0, 0, 0, 0)
  return start
}

/**
 * Real month calendar — 6×7 grid of day cells, each showing that day's items
 * (timetable slots, events, dated to-dos & subject tasks, note deadlines,
 * upcoming focus sessions) plus every synced Google Calendar event when
 * connected. Click a day to open it in the Day view.
 */
export function MonthGrid({
  slots = [],
  events = [],
  todos = [],
  tasks = [],
  noteDeadlines = [],
  sessions = [],
  onPickDay,
}) {
  const gcalEvents = useStore((s) => s.gcalEvents)
  const setupError = useStore((s) => s.gcalSetupError)
  const setSelectedDate = useStore((s) => s.setSelectedDate)
  const [offset, setOffset] = useState(0)

  const view = useMemo(() => {
    const base = new Date()
    base.setDate(1)
    base.setMonth(base.getMonth() + offset)
    return { year: base.getFullYear(), month: base.getMonth(), label: MONTH_FMT.format(base) }
  }, [offset])

  const todayStr = ymd(new Date())

  const weeks = useMemo(() => {
    const start = startOfMonthGrid(view.year, view.month)
    const cells = []
    for (let i = 0; i < 42; i++) {
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
        includeSessions: false,
      })
      cells.push({
        date: d,
        dateStr: ymd(d),
        inMonth: d.getMonth() === view.month,
        isToday: ymd(d) === todayStr,
        items,
      })
    }
    const rows = []
    for (let r = 0; r < 6; r++) rows.push(cells.slice(r * 7, r * 7 + 7))
    // Drop a trailing empty week (some months only need 5 rows).
    if (rows[5].every((c) => !c.inMonth)) rows.pop()
    return rows
  }, [view, slots, events, todos, tasks, noteDeadlines, sessions, gcalEvents, todayStr])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {setupError && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            {setupError.message}{' '}
            {setupError.consoleUrl && (
              <a href={setupError.consoleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline">
                Console <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
        </div>
      )}

      {/* Month nav */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-ink">{view.label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
            className={cn(
              'rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-all',
              offset === 0 ? 'border-accent/30 bg-accent/15 text-accent' : 'border-white/10 bg-surface-2/30 text-muted hover:text-ink',
            )}
          >
            Today
          </button>
          <button type="button" onClick={() => setOffset((o) => o - 1)} className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-surface-2/30 text-muted hover:text-ink" aria-label="Previous month">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setOffset((o) => o + 1)} className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-surface-2/30 text-muted hover:text-ink" aria-label="Next month">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 border-b border-line/40 pb-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="mt-1 grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1 overflow-y-auto">
        {weeks.flat().map((cell) => (
          <button
            key={cell.dateStr}
            type="button"
            onClick={() => {
              setSelectedDate(cell.dateStr)
              onPickDay?.(cell.date)
            }}
            className={cn(
              'flex min-h-[68px] flex-col items-stretch gap-0.5 rounded-lg border p-1 text-left transition-colors',
              cell.inMonth ? 'border-line/40 bg-surface/40 hover:border-accent/40 hover:bg-surface-2/40' : 'border-transparent bg-transparent opacity-40',
              cell.isToday && 'border-accent/70 bg-accent/10',
            )}
          >
            <span className={cn('text-[11px] font-bold tabular-nums', cell.isToday ? 'text-accent' : cell.inMonth ? 'text-ink' : 'text-muted')}>
              {cell.date.getDate()}
            </span>
            <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
              {cell.items.slice(0, 3).map((it) => (
                <span
                  key={it.id}
                  className={cn(
                    'flex items-center gap-1 truncate rounded px-1 py-px text-[9px] leading-tight',
                    it.kind === 'gcal' ? 'text-white' : 'bg-surface-2/60 text-ink',
                    it.done && 'line-through opacity-50',
                  )}
                  style={it.kind === 'gcal' ? { backgroundColor: it.color } : undefined}
                  title={it.title}
                >
                  {it.kind !== 'gcal' && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />}
                  <span className="truncate">{it.title}</span>
                </span>
              ))}
              {cell.items.length > 3 && (
                <span className="text-[9px] font-semibold text-muted">+{cell.items.length - 3} more</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
