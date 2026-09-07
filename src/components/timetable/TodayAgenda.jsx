import { useRef, useEffect, useState, useMemo, forwardRef } from 'react'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  Flag,
  Sparkles,
  GraduationCap,
  Timer,
  StickyNote,
  SquareKanban,
  CalendarClock,
  ArrowRight,
} from 'lucide-react'
import { DAYS, DAY_FULL, todayDow, minutesToLabel, durationLabel } from '@/lib/time'
import { getWeekDate, ymd } from '@/lib/dates'
import { classifyDeadline } from '@/lib/deadlines'
import { useNowMinutes } from '@/hooks/useNowMinutes'
import { useStore } from '@/store/useStore'
import { buildDayTimeline, summarizeDay } from '@/lib/dayAgenda'
import { cn } from '@/utils/cn'

// -------------------------------------------------------------------
// Per-kind presentation. Icons are named Lucide imports (never `* as`).
// -------------------------------------------------------------------
const KIND_UI = {
  slot: { Icon: GraduationCap, noun: 'Session' },
  event: { Icon: Sparkles, noun: 'Event' },
  todo: { Icon: Flag, noun: 'To-do' },
  task: { Icon: SquareKanban, noun: 'Task' },
  session: { Icon: Timer, noun: 'Focus' },
  note: { Icon: StickyNote, noun: 'Note' },
}

const RAIL = 'w-14 shrink-0'

/** "3h 20m left" style label (0 → "0m"). */
function leftLabel(min) {
  const m = Math.max(0, Math.round(min))
  return durationLabel(0, m || 0) || '0m'
}

function timeRange(item) {
  if (item.startMin == null) return 'Anytime'
  if (item.endMin == null || item.endMin <= item.startMin) return minutesToLabel(item.startMin)
  return `${minutesToLabel(item.startMin)} – ${minutesToLabel(item.endMin)}`
}

/**
 * Single-day view: one merged, chronological timeline of everything dated for
 * the selected day — timetable slots, one-time events, due to-dos & tasks,
 * completed focus sessions and note deadlines. Powered by the pure
 * `buildDayTimeline` aggregator so it stays free-tier (no new reads).
 */
export function TodayAgenda({
  slots = [],
  events = [],
  tasks = [],
  noteDeadlines = [],
  onOpenNote,
  allTodos = [],
  onOpenSlot,
  onAdd,
  onSelect,
  onToggleTask,
  onDeleteTask,
  onDeleteEvent,
  sessions = [],
}) {
  const today = todayDow()
  const [selectedDay, setSelectedDay] = useState(today)
  const [weekOffset, setWeekOffset] = useState(0)
  const nowMinRaw = useNowMinutes()
  const nowMin = Math.round(nowMinRaw)
  const scrollRef = useRef(null)
  const nowRef = useRef(null)

  const activeModeId = useStore((s) => s.activeModeId)
  const modes = useStore((s) => s.modes)
  const isAllScopes = activeModeId === 'all'
  const modeColorById = useMemo(() => {
    const map = {}
    for (const m of modes || []) map[m.id] = m.accentColor
    return map
  }, [modes])

  const activeRefDate = useMemo(() => {
    const d = new Date()
    if (weekOffset !== 0) d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [weekOffset])

  const selectedDate = useMemo(
    () => getWeekDate(selectedDay, activeRefDate),
    [selectedDay, activeRefDate],
  )
  const selectedDateStr = useMemo(() => ymd(selectedDate), [selectedDate])
  const isSelectedToday = selectedDay === today && weekOffset === 0

  // Merged, sorted timeline for the selected day.
  const timeline = useMemo(
    () =>
      buildDayTimeline({
        slots,
        events,
        todos: allTodos,
        tasks,
        sessions,
        notes: noteDeadlines,
        date: selectedDate,
        nowMin: isSelectedToday ? nowMin : null,
      }),
    [slots, events, allTodos, tasks, sessions, noteDeadlines, selectedDate, isSelectedToday, nowMin],
  )

  const anytime = useMemo(() => timeline.filter((i) => i.startMin == null), [timeline])
  const timed = useMemo(() => timeline.filter((i) => i.startMin != null), [timeline])
  const summary = useMemo(
    () => summarizeDay(timeline, isSelectedToday ? nowMin : null),
    [timeline, isSelectedToday, nowMin],
  )

  // Index of the first not-yet-past timed item → where the "now" line sits.
  const nowIndex = useMemo(() => {
    if (!isSelectedToday) return -1
    const idx = timed.findIndex((i) => (i.endMin ?? i.startMin) > nowMin)
    return idx === -1 ? timed.length : idx
  }, [timed, isSelectedToday, nowMin])

  // Which days of the week have anything, for the strip dots.
  const daysWithItems = useMemo(() => {
    const set = new Set()
    for (let d = 0; d < 7; d++) {
      const items = buildDayTimeline({
        slots,
        events,
        todos: allTodos,
        tasks,
        sessions,
        notes: noteDeadlines,
        date: getWeekDate(d, activeRefDate),
      })
      if (items.length) set.add(d)
    }
    return set
  }, [slots, events, allTodos, tasks, sessions, noteDeadlines, activeRefDate])

  // Next day (within 2 weeks) that has something, for the empty state.
  const nextBusyDay = useMemo(() => {
    for (let off = 1; off <= 14; off++) {
      const d = new Date(selectedDate)
      d.setDate(d.getDate() + off)
      const items = buildDayTimeline({
        slots,
        events,
        todos: allTodos,
        tasks,
        sessions,
        notes: noteDeadlines,
        date: d,
      })
      if (items.length) return d
    }
    return null
  }, [selectedDate, slots, events, allTodos, tasks, sessions, noteDeadlines])

  const goPrevDay = () => {
    if (selectedDay === 0) {
      setWeekOffset((w) => w - 1)
      setSelectedDay(6)
    } else setSelectedDay((d) => d - 1)
  }
  const goNextDay = () => {
    if (selectedDay === 6) {
      setWeekOffset((w) => w + 1)
      setSelectedDay(0)
    } else setSelectedDay((d) => d + 1)
  }
  const jumpToday = () => {
    setWeekOffset(0)
    setSelectedDay(today)
  }

  // Route creation through the existing NlQuickCapture / SlotEditor path the
  // widget already wires up (onSelect preferred, onAdd fallback).
  const addAt = (startMin) => {
    const s = Math.max(6 * 60, Math.min(startMin, 23 * 60))
    if (onSelect) onSelect({ dayIndex: selectedDay, startMin: s, endMin: s + 60 })
    else if (onAdd) onAdd(s, s + 60, selectedDay)
  }

  const openItem = (item) => {
    // TODO(P7): openModule(item.kind, { itemId: item.ref.id, subjectId: item.subjectId })
    if (item.kind === 'note') return onOpenNote?.(item.ref)
    if (item.kind === 'session') return
    if (item.kind === 'slot') return onOpenSlot?.(item.ref)
    // event / todo / task → focus on it via the synthetic-slot path
    onOpenSlot?.({
      label: item.title,
      startMin: item.startMin ?? nowMin,
      endMin: item.endMin ?? Math.min((item.startMin ?? nowMin) + 30, 24 * 60),
      color: item.color,
    })
  }

  const removeItem = (item) => {
    if (item.kind === 'event') onDeleteEvent?.(item.ref.id)
    else if (item.kind === 'todo' || item.kind === 'task') onDeleteTask?.(item.ref.id)
  }

  // Auto-scroll so "now" (or the first item) sits mid-view on day change.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = nowRef.current
    if (target) el.scrollTop = Math.max(0, target.offsetTop - el.clientHeight / 2)
    else el.scrollTop = 0
  }, [selectedDateStr, isSelectedToday])

  const dayIsEmpty = timeline.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── Day navigation ── */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={goPrevDay}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            title="Previous day"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-bold text-ink">
            {DAY_FULL[selectedDay]},{' '}
            {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
          {isSelectedToday ? (
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
              Today
            </span>
          ) : (
            <button
              onClick={jumpToday}
              className="rounded-md bg-surface-2/80 px-1.5 py-0.5 text-[9px] font-medium text-muted transition-colors hover:bg-surface-3 hover:text-ink"
              title="Jump back to today"
            >
              Today
            </button>
          )}
          <button
            onClick={goNextDay}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            title="Next day"
            aria-label="Next day"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          onClick={() => addAt(isSelectedToday ? nowMin : 9 * 60)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {/* ── 7-day strip ── */}
      <div className="grid shrink-0 grid-cols-7 gap-1 rounded-xl border border-line/40 bg-surface-2/30 p-1">
        {DAYS.map((name, idx) => {
          const isSel = selectedDay === idx
          const isCur = today === idx && weekOffset === 0
          const dayDate = getWeekDate(idx, activeRefDate)
          return (
            <button
              key={name}
              onClick={() => setSelectedDay(idx)}
              className={cn(
                'relative flex select-none flex-col items-center justify-center rounded-lg px-0.5 py-1 transition-all',
                isSel
                  ? 'bg-accent/20 font-bold text-accent shadow-sm'
                  : 'text-muted hover:bg-surface hover:text-ink',
                isCur && !isSel && 'font-bold text-ink',
              )}
              title={`${DAY_FULL[idx]}, ${dayDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
            >
              <span className="text-[10px] font-medium leading-tight">{name}</span>
              <span className="mt-0.5 text-xs font-bold leading-tight tabular-nums">
                {dayDate.getDate()}
              </span>
              <span
                className={cn(
                  'mt-0.5 h-1 w-1 rounded-full transition-all',
                  daysWithItems.has(idx) ? 'scale-100 bg-accent opacity-100' : 'scale-50 opacity-0',
                )}
              />
            </button>
          )
        })}
      </div>

      {/* ── Timeline ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line/30 bg-surface/30">
        <div
          ref={scrollRef}
          className="scrollbar-thin scrollbar-thumb-white/15 hover:scrollbar-thumb-white/25 h-full w-full overflow-y-auto overscroll-contain px-2 py-2"
        >
          {/* Anytime bucket */}
          {anytime.length > 0 && (
            <div className="mb-2 rounded-xl border border-line/40 bg-surface-2/30 p-1.5">
              <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                <CalendarClock className="h-3 w-3 text-accent" /> Anytime
                <span className="rounded-full bg-surface-3 px-1.5 text-[9px] font-semibold text-ink">
                  {anytime.length}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {anytime.map((item) => (
                  <AgendaCard
                    key={item.id}
                    item={item}
                    compact
                    modeDot={isAllScopes ? item.modeColor || modeColorById[item.modeId] : null}
                    onOpen={() => openItem(item)}
                    onToggle={
                      item.kind === 'todo' || item.kind === 'task'
                        ? () => onToggleTask?.(item.ref)
                        : null
                    }
                    onDelete={
                      item.kind === 'event' || item.kind === 'todo' || item.kind === 'task'
                        ? () => removeItem(item)
                        : null
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Timed list with a continuous left connector */}
          {timed.length > 0 && (
            <ol className="relative">
              <span className="pointer-events-none absolute bottom-2 left-[3.4rem] top-2 w-px bg-line/40" />
              {timed.map((item, i) => (
                <li key={item.id}>
                  {i === nowIndex && <NowMarker ref={nowRef} nowMin={nowMin} />}
                  <div className="flex items-start gap-1 py-1">
                    <span
                      className={cn(
                        RAIL,
                        'pt-1.5 text-right text-[10px] font-semibold tabular-nums',
                        item.past ? 'text-muted/50' : 'text-muted',
                      )}
                    >
                      {minutesToLabel(item.startMin)}
                    </span>
                    <span
                      className="relative mt-2 h-2 w-2 shrink-0 rounded-full ring-2 ring-surface"
                      style={{ background: item.color }}
                    />
                    <div className="min-w-0 flex-1 pl-1">
                      <AgendaCard
                        item={item}
                        modeDot={isAllScopes ? item.modeColor || modeColorById[item.modeId] : null}
                        onOpen={() => openItem(item)}
                        onToggle={
                          item.kind === 'todo' || item.kind === 'task'
                            ? () => onToggleTask?.(item.ref)
                            : null
                        }
                        onDelete={
                          item.kind === 'event' || item.kind === 'todo' || item.kind === 'task'
                            ? () => removeItem(item)
                            : null
                        }
                      />
                    </div>
                  </div>
                </li>
              ))}
              {isSelectedToday && nowIndex >= timed.length && <NowMarker ref={nowRef} nowMin={nowMin} />}
            </ol>
          )}

          {/* Empty state */}
          {dayIsEmpty && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="rounded-full border border-line/40 bg-surface-2/90 px-3 py-1 text-[10px] font-medium text-muted">
                Nothing on {DAY_FULL[selectedDay]} — tap a time or + Add
              </span>
              {nextBusyDay && (
                <button
                  onClick={() => {
                    const weeks = Math.round(
                      (getWeekDate(0, nextBusyDay).getTime() - getWeekDate(0, new Date()).getTime()) /
                        (7 * 86400000),
                    )
                    setWeekOffset(weeks)
                    setSelectedDay((nextBusyDay.getDay() + 6) % 7)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/20"
                >
                  Next:{' '}
                  {nextBusyDay.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line/40 pt-2 text-[10px] text-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <Timer className="h-3 w-3 text-accent/70" />
          {summary.remainingMin == null
            ? `${timeline.length} item${timeline.length === 1 ? '' : 's'}`
            : `End of day · ${leftLabel(summary.remainingMin)} left`}
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="h-3 w-3 text-emerald-400" />
          {summary.doneCount}/{summary.totalCount} done
          {summary.nextItem && (
            <span className="ml-1 truncate text-muted/80">· next {summary.nextItem.title}</span>
          )}
        </span>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Now line — a red rule + timestamp inserted between past & upcoming.
// -------------------------------------------------------------------
const NowMarker = forwardRef(function NowMarker({ nowMin }, ref) {
  return (
    <div ref={ref} className="flex items-center gap-1 py-1">
      <span className={cn(RAIL, 'text-right text-[10px] font-bold tabular-nums text-rose-500')}>
        {minutesToLabel(nowMin)}
      </span>
      <span className="h-2 w-2 shrink-0 -translate-x-[3px] rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]" />
      <span className="h-px flex-1 bg-rose-500/70" />
    </div>
  )
})

// -------------------------------------------------------------------
// One agenda card.
// -------------------------------------------------------------------
function AgendaCard({ item, compact = false, modeDot, onOpen, onToggle, onDelete }) {
  const meta = KIND_UI[item.kind] || KIND_UI.todo
  const { Icon } = meta
  const overdue =
    (item.kind === 'todo' || item.kind === 'task' || item.kind === 'note') &&
    !item.done &&
    classifyDeadline(item.ref?.dueAt) === 'overdue'

  return (
    <div
      onClick={onOpen}
      className={cn(
        'group flex items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-all',
        'cursor-pointer border-line/40 bg-surface-2/50 hover:bg-surface-2',
        item.past && !item.done && 'opacity-70',
        item.done && 'opacity-55',
      )}
      style={{ borderLeft: `3px solid ${item.color}` }}
      title={`${meta.noun} · ${timeRange(item)}`}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="shrink-0"
          title={item.done ? 'Mark incomplete' : 'Mark complete'}
          aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
        >
          <Check
            className={cn(
              'h-3.5 w-3.5 transition-colors',
              item.done ? 'text-emerald-400' : 'text-muted/50 hover:text-ink',
            )}
          />
        </button>
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted/70" />
      )}

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            'truncate text-xs font-semibold text-ink',
            item.done && 'text-muted line-through',
          )}
        >
          {item.title}
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="tabular-nums">{timeRange(item)}</span>
            {item.startMin != null && item.endMin != null && item.endMin > item.startMin && (
              <span className="text-muted/70">· {durationLabel(item.startMin, item.endMin)}</span>
            )}
            {overdue && (
              <span className="flex items-center gap-0.5 font-semibold text-rose-400">
                <Flag className="h-2.5 w-2.5" /> overdue
              </span>
            )}
          </div>
        )}
      </div>

      {modeDot && (
        <span
          className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/20"
          style={{ background: modeDot }}
          title="Scope"
        />
      )}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="shrink-0 text-muted/40 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
