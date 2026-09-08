import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { Pencil, Sparkles, X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { classifyDeadline } from '@/lib/deadlines'
import { NoteDeadlineChip } from './NoteDeadlineChip'
import { ItemDetailPopover } from './ItemDetailPopover'
import { getWeekDate, ymd } from '@/lib/dates'
import { DayGrove } from '@/components/focus/CalendarForest'
import {
  DAYS,
  DAY_START_MIN,
  DAY_END_MIN,
  PX_PER_MIN,
  MIN_SLOT,
  todayDow,
  minutesToAxis,
  minutesToLabel,
  snap,
  clampMin,
  isSlotOnDay,
} from '@/lib/time'
import { useNowMinutes } from '@/hooks/useNowMinutes'
import { cn } from '@/utils/cn'

const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN
const GRID_H = TOTAL_MIN * PX_PER_MIN

// Tick arrays — computed once
const hours = []
for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) hours.push(m)

const halfHours = []
for (let m = DAY_START_MIN + 30; m < DAY_END_MIN; m += 60) halfHours.push(m)

// ── Helpers ───────────────────────────────────────────────────────────────────

function yToMin(clientY, rect) {
  return clampMin(snap(DAY_START_MIN + (clientY - rect.top) / PX_PER_MIN, 5))
}

function hexA(hex, a) {
  const h = (hex || '#6366f1').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// ── Block components ──────────────────────────────────────────────────────────

const SlotBlock = memo(function SlotBlock({ slot, onOpen, onEdit }) {
  const top = (slot.startMin - DAY_START_MIN) * PX_PER_MIN
  const height = Math.max(26, (slot.endMin - slot.startMin) * PX_PER_MIN)

  const isStriped =
    slot.tagStyle === 'striped' ||
    (!slot.tagStyle && slot.tag?.toLowerCase().includes('lab'))
  const isDashed =
    slot.tagStyle === 'dashed' ||
    (!slot.tagStyle && slot.tag?.toLowerCase().includes('revision'))
  const isDotted = slot.tagStyle === 'dotted'

  const accent = slot.color || '#6366f1'

  const bgStyle = isStriped
    ? `repeating-linear-gradient(45deg, ${hexA(accent, 0.7)}, ${hexA(accent, 0.7)} 10px, ${hexA(accent, 0.9)} 10px, ${hexA(accent, 0.9)} 20px)`
    : hexA(accent, 0.82)

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      className={cn(
        'group/slot absolute inset-x-1 cursor-pointer overflow-hidden rounded-xl px-2.5 py-1.5 text-white shadow-sm transition-all hover:z-30 hover:scale-[1.02] hover:shadow-glow-sm backdrop-blur-md select-none',
        isDashed && 'border-2 border-dashed',
        isDotted && 'border-2 border-dotted',
      )}
      style={{
        top,
        height,
        background: bgStyle,
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate text-xs font-semibold leading-tight text-white drop-shadow-xs">
          {slot.label || 'Session'}
          {slot.tag && (
            <span className="ml-1.5 inline-block rounded-md bg-black/35 px-1.5 py-0.2 text-[9px] font-medium tracking-wider text-white">
              {slot.tag}
            </span>
          )}
        </span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="shrink-0 opacity-0 transition-opacity group-hover/slot:opacity-100 text-white/80 hover:text-white"
          aria-label="Edit session"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      {height > 30 && (
        <span className="text-[10px] font-medium text-white/80 mt-0.5 block tabular-nums">
          {minutesToLabel(slot.startMin)} – {minutesToLabel(slot.endMin)}
        </span>
      )}
    </div>
  )
})

/** One-time event block (todo with type='event'). */
const EventBlock = memo(function EventBlock({ event, onDelete, onOpen }) {
  const startMin =
    event.eventStartMin ??
    (event.dueAt ? (event.dueAt?.toDate ? event.dueAt.toDate() : new Date(event.dueAt)).getHours() * 60 : 0)
  const endMin = event.eventEndMin ?? startMin + 60
  const top = (startMin - DAY_START_MIN) * PX_PER_MIN
  const height = Math.max(26, (endMin - startMin) * PX_PER_MIN)

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onOpen?.(event)}
      className="group/event absolute inset-x-1 z-25 flex flex-col justify-between overflow-hidden rounded-xl border border-violet-400/35 bg-violet-500/20 px-2.5 py-1.5 shadow-sm backdrop-blur-md transition-all hover:z-30 hover:scale-[1.02] hover:border-violet-400 hover:bg-violet-500/30 cursor-pointer select-none"
      style={{ top, height, borderLeft: '4px solid #a855f7' }}
      title={`${event.text} · ${minutesToLabel(startMin)} – ${minutesToLabel(endMin)} · click to focus`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-violet-100">
          <Sparkles className="h-3 w-3 shrink-0 text-violet-400" />
          <span className="truncate">{event.text}</span>
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(event.id)
            }}
            className="rounded p-0.5 text-violet-300 opacity-0 transition-opacity hover:text-white group-hover/event:opacity-100"
            title="Delete event"
            aria-label="Delete event"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {height > 30 && (
        <span className="text-[10px] text-violet-300/80 font-medium tabular-nums">
          {minutesToLabel(startMin)} – {minutesToLabel(endMin)}
        </span>
      )}
    </div>
  )
})

/** Deadline chip for a todo/task — shows on any day column it falls on. */
const TodoChip = memo(function TodoChip({ item, topPx, onToggle, onDelete }) {
  const urgency = classifyDeadline(item.dueAt)
  const isOverdue = urgency === 'overdue'
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      title={`${item.text || item.title} (due)`}
      className={cn(
        'group/chip absolute right-0.5 z-10 flex max-w-[92%] items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold shadow-sm transition-all hover:scale-105 cursor-pointer',
        isOverdue ? 'bg-rose-500/95 text-white' : 'bg-amber-400/95 text-black',
      )}
      style={{ top: Math.max(0, topPx - 8) }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle?.(item)
        }}
        className="shrink-0 hover:opacity-80"
        title={item.done ? 'Mark incomplete' : 'Mark complete'}
        aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <Check
          className={cn(
            'h-2.5 w-2.5',
            item.done ? 'opacity-100' : 'opacity-40 hover:opacity-100',
          )}
        />
      </button>
      <span className={cn('truncate', item.done && 'line-through opacity-70')}>
        {item.text || item.title}
      </span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item.id)
          }}
          className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:text-rose-700 group-hover/chip:opacity-100"
          title="Delete task"
          aria-label="Delete task"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
})

/** Read-only chip for a synced Google Calendar event, positioned at its time. */
const GcalChip = memo(function GcalChip({ ev, topPx }) {
  return (
    <a
      href={ev.htmlLink || undefined}
      target={ev.htmlLink ? '_blank' : undefined}
      rel="noopener noreferrer"
      onPointerDown={(e) => e.stopPropagation()}
      title={`${ev.title}${ev.location ? ` · ${ev.location}` : ''} · ${ev.calendarName}`}
      className="group/gc absolute left-0.5 right-0.5 z-[9] flex items-center gap-1 overflow-hidden rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
      style={{ top: Math.max(0, topPx - 6), backgroundColor: ev.color || '#4285f4' }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
      <span className="truncate">{ev.title}</span>
    </a>
  )
})

/**
 * Small numbered marker for a to-do created today without a due time — pinned to
 * its `createdAt` minute so the day fills in chronologically (owner: markers
 * should sit at the time they were added, not pile up at the top).
 */
const UndatedMarker = memo(function UndatedMarker({ item, n, topPx, onToggle, onDelete }) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      title={item.text || item.title}
      className="group/um absolute left-0.5 z-10 flex max-w-[90%] items-center gap-1 rounded-full border border-line/70 bg-surface-3/90 px-1.5 py-0.5 text-[9px] font-medium text-ink shadow-xs backdrop-blur-sm transition-transform hover:scale-105"
      style={{ top: Math.max(0, topPx - 8) }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle?.(item) }}
        className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent hover:bg-accent/40"
        title="Mark done"
      >
        {n}
      </button>
      <span className={cn('truncate', item.done && 'line-through opacity-60')}>{item.text || item.title}</span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
          className="rounded p-0.5 opacity-0 transition-opacity hover:text-rose-500 group-hover/um:opacity-100"
          title="Delete"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  )
})

function toDateSafe(v) {
  if (!v) return null
  const d = v?.toDate ? v.toDate() : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

// ── Main grid ─────────────────────────────────────────────────────────────────

/**
 * Full weekly grid.
 *
 * Drag to select a range or tap a slot → `onSelect({ dayIndex, startMin, endMin })`.
 *
 * Props:
 *   slots         — recurring timetable slots
 *   events        — todos with type='event' (one-time blocks)
 *   dateTasks     — todos with dueAt (shown as chips on their matching day)
 *   onSelect      — called with { dayIndex, startMin, endMin }
 *   onOpenSlot    — called when a slot block is clicked (open focus)
 *   onEditSlot    — called on the edit pencil inside a slot
 *   onToggleTask  — called when checking off a task on the calendar
 *   onDeleteTask  — called when deleting a task on the calendar
 *   onDeleteEvent — called when deleting an event on the calendar
 *   compact       — render without bottom help text and with tight margins for dashboard widgets
 */
export function TimetableGrid({
  slots,
  events = [],
  defaultColor: _defaultColor,
  onSelect,
  onOpenSlot,
  onEditSlot,
  onQuickCapture: _onQuickCapture,
  onToggleTask,
  onDeleteTask,
  onDeleteEvent,
  dateTasks = [],
  noteDeadlines = [],
  onOpenNote,
  onPickDay,
  gcalEvents = [],
  subjectTasks = [],
  onToggleSubjectTask,
  allTodos = [],
  sessions = [],
  compact = false,
}) {
  const [drag, setDrag] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [popoverItem, setPopoverItem] = useState(null)
  const scrollRef = useRef(null)
  const today = todayDow()
  const nowMin = useNowMinutes()
  const nowVisible = nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN && weekOffset === 0

  const activeRefDate = useMemo(() => {
    const d = new Date()
    if (weekOffset !== 0) {
      d.setDate(d.getDate() + weekOffset * 7)
    }
    return d
  }, [weekOffset])

  const currentMonthYear = useMemo(() => {
    const thurs = getWeekDate(3, activeRefDate)
    return thurs.toLocaleDateString([], { month: 'long', year: 'numeric' })
  }, [activeRefDate])

  // Auto-scroll so current hour or earliest session is comfortably in view
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (nowVisible) {
      const nowTop = (nowMin - DAY_START_MIN) * PX_PER_MIN
      el.scrollTop = Math.max(0, nowTop - el.clientHeight / 3)
    } else if (slots.length > 0) {
      const minStart = Math.min(...slots.map((s) => s.startMin))
      const top = (minStart - DAY_START_MIN) * PX_PER_MIN
      el.scrollTop = Math.max(0, top - 30)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowVisible, slots])

  const onDown = (day) => (e) => {
    if (e.button !== 0) return
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore pointer capture errors */
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const min = yToMin(e.clientY, rect)
    setDrag({
      day,
      start: min,
      current: min,
      active: false,
      pointerId: e.pointerId,
      target: e.currentTarget,
    })
  }

  const onMove = (e) => {
    if (!drag) return
    const rect = e.currentTarget.getBoundingClientRect()
    const min = yToMin(e.clientY, rect)
    const moved = Math.abs(min - drag.start) >= 5
    setDrag((d) => (d ? { ...d, current: min, active: d.active || moved } : d))
  }

  const onUp = (e) => {
    if (!drag) return
    try {
      (drag.target || e?.currentTarget)?.releasePointerCapture?.(drag.pointerId ?? e?.pointerId)
    } catch {
      /* ignore pointer capture errors */
    }
    const startMin = Math.min(drag.start, drag.current)
    const endMin = Math.max(drag.start, drag.current)
    const day = drag.day
    setDrag(null)
    if (endMin - startMin >= MIN_SLOT) {
      onSelect?.({ dayIndex: day, startMin, endMin })
    } else {
      // Single tap/click on a cell: select a clean 1-hour slot at the clicked time
      const clickEnd = Math.min(startMin + 60, DAY_END_MIN)
      onSelect?.({ dayIndex: day, startMin, endMin: clickEnd })
    }
  }

  const onContextMenu = (day) => (e) => {
    e.preventDefault()
    const min = yToMin(e.clientY, e.currentTarget.getBoundingClientRect())
    const endMin = Math.min(min + 60, DAY_END_MIN)
    onSelect?.({ dayIndex: day, startMin: min, endMin })
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Month & Week Navigation Bar (Inspired by calendar.me & ToDoTimeline) */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.08] bg-surface/30 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-bold tracking-tight text-ink">
            {currentMonthYear}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className={cn(
              'rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-all',
              weekOffset === 0
                ? 'bg-accent/15 text-accent border-accent/30'
                : 'border-white/10 bg-surface-2/30 text-muted hover:text-ink',
            )}
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-surface-2/30 text-muted hover:bg-surface-2/60 hover:text-ink transition-all active:scale-95"
            title="Previous week"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-surface-2/30 text-muted hover:bg-surface-2/60 hover:text-ink transition-all active:scale-95"
            title="Next week"
            aria-label="Next week"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tactile Day Header Strip (Inspired by calendar.me) */}
      <div className="flex border-b border-white/[0.08] pb-2 pt-1.5 pl-12 pr-1 gap-1.5 shrink-0 bg-surface/20">
        {DAYS.map((d, i) => {
          const colDate = getWeekDate(i, activeRefDate)
          const dateNum = colDate.getDate()
          const isToday = i === today && weekOffset === 0
          return (
            <div
              key={d}
              onClick={() => onPickDay?.(colDate)}
              title={`Open ${d} ${dateNum} in the day view`}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-1.5 px-1 rounded-2xl border transition-all cursor-pointer select-none',
                isToday
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-slate-950 font-bold shadow-glow-sm border-emerald-300 ring-2 ring-emerald-400/30'
                  : 'border-white/[0.06] bg-surface-2/25 text-muted hover:bg-surface-2/50 hover:text-ink hover:border-white/15',
              )}
            >
              <span className={cn('text-[10px] uppercase font-bold tracking-wider', isToday ? 'text-slate-950/80' : 'text-muted')}>
                {d}
              </span>
              <span className={cn('text-base font-black tracking-tight tabular-nums mt-0.5', isToday ? 'text-slate-950' : 'text-ink')}>
                {dateNum}
              </span>
            </div>
          )
        })}
      </div>

      {/* All-Day / Tasks shelf across the week — compact markers with rich side detail (P10) */}
      <div className="flex border-b border-line/50 pl-12 bg-surface-2/20 shrink-0 min-h-[30px] max-h-[58px]">
        {DAYS.map((d, day) => {
          const colDate = getWeekDate(day, activeRefDate)
          const colDateStr = ymd(colDate)
          const isCurrentToday = day === today && weekOffset === 0

          // Tasks for this day's top tray:
          // 1. All-day tasks due on this day or tasks with midnight deadline
          // 2. Unscheduled tasks (no dueAt) when day is today
          // 3. Overdue incomplete tasks carried forward onto today
          const dayTopTasks = allTodos.filter((t) => {
            if (t.type === 'event' || t.source === 'gcal') return false
            const isDone = Boolean(t.done) || t.column === 'done'
            // Undated to-dos now sit inline on the grid at their created time
            // (see UndatedMarker below) — not piled in this all-day tray.
            if (!t.dueAt) return false
            const d2 = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
            if (isNaN(d2.getTime())) return false
            const isDueToday = ymd(d2) === colDateStr
            const mins = d2.getHours() * 60 + d2.getMinutes()
            const isUntimedOrMidnight = t.allDay || mins === 0 || mins < DAY_START_MIN
            if (isDueToday) return isUntimedOrMidnight
            // Display-only carry-forward for incomplete overdue items onto today
            if (isCurrentToday && !isDone && d2 < new Date()) return true
            return false
          })

          const VISIBLE_COUNT = 2
          const visibleTasks = dayTopTasks.slice(0, VISIBLE_COUNT)
          const overflowCount = Math.max(0, dayTopTasks.length - VISIBLE_COUNT)

          return (
            <div
              key={`tray-${d}`}
              onDoubleClick={(e) => {
                e.stopPropagation()
                onSelect?.({ dayIndex: day, startMin: 9 * 60, endMin: 10 * 60, allDay: true })
              }}
              className={cn(
                'flex-1 border-l border-line/30 p-1 flex flex-wrap items-center content-start gap-1 min-h-[30px] transition-colors overflow-hidden',
                isCurrentToday && 'bg-accent/5',
              )}
              title={`Double-click to add an all-day item on ${d}`}
            >
              {visibleTasks.map((t, idx) => {
                const d2 = t.dueAt ? (t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)) : null
                const isCarried = isCurrentToday && d2 && ymd(d2) !== colDateStr
                const itemData = {
                  ...t,
                  carriedFrom: isCarried ? ymd(d2) : undefined,
                  overdue: isCarried,
                }

                return (
                  <div
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      setPopoverItem({ item: itemData, anchorRect: rect })
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setPopoverItem({ item: itemData, anchorRect: rect })
                    }}
                    className={cn(
                      'group/marker flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium transition-all shadow-xs border max-w-full',
                      isCarried
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-surface-3/80 border-line/70 text-ink hover:border-accent/50 hover:bg-surface-3',
                    )}
                    title={`${t.text || t.title}${isCarried ? ` (carried from ${ymd(d2)})` : ''}`}
                  >
                    <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[8px] font-bold text-accent">
                      {idx + 1}
                    </span>
                    <span className={cn('truncate max-w-[58px]', t.done && 'line-through opacity-60')}>
                      {t.text || t.title}
                    </span>
                  </div>
                )
              })}

              {overflowCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    setPopoverItem({ item: dayTopTasks[VISIBLE_COUNT], anchorRect: rect })
                  }}
                  className="flex items-center rounded-full bg-surface-3/90 border border-line/80 px-1.5 py-0.5 text-[8px] font-bold text-muted hover:text-ink hover:border-accent transition-colors"
                  title={`${overflowCount} more tasks`}
                >
                  +{overflowCount}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable grid body */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: GRID_H }}>

          {/* Time axis */}
          <div className="relative w-12 shrink-0">
            {hours.map((m) => (
              <div
                key={m}
                className="absolute right-0 -translate-y-1/2 pr-2 text-right text-[10px] text-muted"
                style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
              >
                {minutesToAxis(m)}
              </div>
            ))}
            {halfHours.map((m) => (
              <div
                key={`hh-${m}`}
                className="absolute right-2 w-1.5 border-t border-line/25"
                style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
              />
            ))}
          </div>

          {/* Grid columns */}
          <div className="relative flex flex-1">
            {/* Hour grid lines */}
            {hours.map((m) => (
              <div
                key={m}
                className="pointer-events-none absolute left-0 right-0 border-t border-line/40"
                style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
              />
            ))}
            {/* Half-hour grid lines (lighter) */}
            {halfHours.map((m) => (
              <div
                key={`hh-${m}`}
                className="pointer-events-none absolute left-0 right-0 border-t border-line/15"
                style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
              />
            ))}

            {DAYS.map((d, day) => {
              const colDate = getWeekDate(day, activeRefDate)
              const colDateStr = ymd(colDate)
              const isCurrentDayToday = day === today && weekOffset === 0

              return (
                <div
                  key={d}
                  onPointerDown={onDown(day)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onContextMenu={onContextMenu(day)}
                  className={cn(
                    'relative flex-1 touch-none border-l border-line/30 flex flex-col justify-between overflow-visible',
                    isCurrentDayToday && 'bg-accent/5',
                  )}
                >
                  {/* Recurring slots */}
                  {slots
                    .filter((s) => isSlotOnDay(s, day))
                    .map((s) => (
                      <SlotBlock
                        key={s.id}
                        slot={s}
                        onOpen={() => onOpenSlot(s)}
                        onEdit={() => onEditSlot(s)}
                      />
                    ))}

                  {/* One-time event blocks */}
                  {events
                    .filter((e) => {
                      const eDateStr =
                        e.eventDate ||
                        (e.dueAt ? ymd(e.dueAt?.toDate ? e.dueAt.toDate() : new Date(e.dueAt)) : null)
                      return eDateStr === colDateStr
                    })
                    .map((e) => (
                      <EventBlock
                        key={e.id}
                        event={e}
                        onDelete={onDeleteEvent}
                        onOpen={(ev) =>
                          onOpenSlot?.({
                            label: ev.text,
                            startMin: ev.eventStartMin ?? 0,
                            endMin: ev.eventEndMin ?? 60,
                            color: '#8b5cf6',
                          })
                        }
                      />
                    ))}

                  {/* Deadline chips — any day that has a matching todo with a specific time */}
                  {dateTasks
                    .filter((t) => {
                      if (!t.dueAt) return false
                      const d2 = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
                      if (isNaN(d2.getTime())) return false
                      if (ymd(d2) !== colDateStr) return false
                      const mins = d2.getHours() * 60 + d2.getMinutes()
                      return !t.allDay && mins >= DAY_START_MIN
                    })
                    .map((t, idx) => {
                      const d2 = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
                      let mins = d2.getHours() * 60 + d2.getMinutes()
                      if (mins > DAY_END_MIN) mins = DAY_END_MIN - 15
                      return (
                        <TodoChip
                          key={t.id}
                          item={t}
                          topPx={(mins - DAY_START_MIN) * PX_PER_MIN + (idx % 2 === 1 ? 12 : 0)}
                          onToggle={onToggleTask}
                          onDelete={onDeleteTask}
                        />
                      )
                    })}

                  {/* Note deadlines — blinking chips on the day the note is due */}
                  {noteDeadlines
                    .filter((n) => {
                      if (!n.dueAt) return false
                      const d2 = n.dueAt?.toDate ? n.dueAt.toDate() : new Date(n.dueAt)
                      if (isNaN(d2.getTime())) return false
                      return ymd(d2) === colDateStr
                    })
                    .map((n, idx) => {
                      const d2 = n.dueAt?.toDate ? n.dueAt.toDate() : new Date(n.dueAt)
                      let mins = d2.getHours() * 60 + d2.getMinutes()
                      if (mins < DAY_START_MIN) mins = DAY_START_MIN
                      if (mins > DAY_END_MIN) mins = DAY_END_MIN - 15
                      return (
                        <NoteDeadlineChip
                          key={n.id}
                          note={n}
                          topPx={(mins - DAY_START_MIN) * PX_PER_MIN + (idx % 2 === 1 ? 12 : 0)}
                          onOpen={onOpenNote}
                        />
                      )
                    })}

                  {/* Subject Kanban tasks that carry a day/time */}
                  {subjectTasks
                    .filter((t) => {
                      const d2 = toDateSafe(t.dueAt)
                      if (!d2) return false
                      if (ymd(d2) !== colDateStr) return false
                      const mins = d2.getHours() * 60 + d2.getMinutes()
                      return !t.allDay && mins >= DAY_START_MIN
                    })
                    .map((t, idx) => {
                      const d2 = toDateSafe(t.dueAt)
                      let mins = d2.getHours() * 60 + d2.getMinutes()
                      if (mins > DAY_END_MIN) mins = DAY_END_MIN - 15
                      return (
                        <TodoChip
                          key={`st-${t.id}`}
                          item={{ ...t, text: t.title || t.text }}
                          topPx={(mins - DAY_START_MIN) * PX_PER_MIN + (idx % 2 === 1 ? 12 : 0)}
                          onToggle={onToggleSubjectTask}
                        />
                      )
                    })}

                  {/* Synced Google Calendar events — read-only, at their real time */}
                  {gcalEvents
                    .filter((ev) => !ev.allDay && ev.dateStr === colDateStr && typeof ev.startMin === 'number')
                    .map((ev, idx) => {
                      let mins = ev.startMin
                      if (mins < DAY_START_MIN) mins = DAY_START_MIN
                      if (mins > DAY_END_MIN) mins = DAY_END_MIN - 15
                      return (
                        <GcalChip
                          key={ev.id}
                          ev={ev}
                          topPx={(mins - DAY_START_MIN) * PX_PER_MIN + (idx % 2 === 1 ? 11 : 0)}
                        />
                      )
                    })}

                  {/* Undated to-dos created today — numbered, at their created time */}
                  {isCurrentDayToday &&
                    allTodos
                      .filter(
                        (t) =>
                          t.source !== 'gcal' &&
                          t.type !== 'event' &&
                          !t.dueAt &&
                          !(t.done || t.column === 'done') &&
                          toDateSafe(t.createdAt),
                      )
                      .sort(
                        (a, b) =>
                          (toDateSafe(a.createdAt)?.getTime() || 0) -
                          (toDateSafe(b.createdAt)?.getTime() || 0),
                      )
                      .map((t, idx) => {
                        const c = toDateSafe(t.createdAt)
                        let mins = c.getHours() * 60 + c.getMinutes()
                        if (mins < DAY_START_MIN) mins = DAY_START_MIN
                        if (mins > DAY_END_MIN) mins = DAY_END_MIN - 15
                        return (
                          <UndatedMarker
                            key={t.id}
                            item={t}
                            n={idx + 1}
                            topPx={(mins - DAY_START_MIN) * PX_PER_MIN}
                            onToggle={onToggleTask}
                            onDelete={onDeleteTask}
                          />
                        )
                      })}

                  {/* Drag selection ghost */}
                  {drag && drag.day === day && (
                    <div
                      className="pointer-events-none absolute inset-x-1 rounded-lg border-2 border-dashed border-accent bg-accent/15 transition-all"
                      style={{
                        top:
                          (Math.min(drag.start, drag.current) - DAY_START_MIN) * PX_PER_MIN,
                        height: Math.max(
                          MIN_SLOT * PX_PER_MIN,
                          Math.abs(drag.current - drag.start) * PX_PER_MIN,
                        ),
                      }}
                    >
                      {!drag.active && (
                        <span className="absolute inset-x-0 top-1 select-none text-center text-[10px] font-semibold text-accent/80">
                          drag to select
                        </span>
                      )}
                    </div>
                  )}

                  {/* ── Illustrated Calendar Forest Grove (User's hand-drawn trees & bushes) ── */}
                  <DayGrove
                    sessions={sessions}
                    dateStr={colDateStr}
                    dayIndex={day}
                    isToday={isCurrentDayToday}
                  />
                </div>
              )
            })}

            {/* Now line */}
            {nowVisible && (() => {
              const passedPercent = Math.round(((nowMin - DAY_START_MIN) / TOTAL_MIN) * 100)
              const remainingHours = ((DAY_END_MIN - nowMin) / 60).toFixed(1)
              const nowTop = (nowMin - DAY_START_MIN) * PX_PER_MIN
              return (
                <>
                  <div
                    className="pointer-events-none absolute z-[5]"
                    style={{
                      left: `${(today / 7) * 100}%`,
                      width: `${(1 / 7) * 100}%`,
                      top: 0,
                      height: nowTop,
                      background:
                        'linear-gradient(to bottom, rgba(16,185,129,0.04), rgba(245,158,11,0.06), rgba(244,63,94,0.08))',
                      borderBottom: '2px solid rgba(244,63,94,0.3)',
                    }}
                  />
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-25 flex items-center gap-1"
                    style={{ top: nowTop }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]" />
                    <span className="h-px flex-1 bg-gradient-to-r from-rose-500/60 to-rose-500/20" />
                    <span className="shrink-0 rounded-lg bg-rose-500 px-2 py-0.5 text-[9px] font-semibold text-white shadow-sm">
                      {minutesToLabel(Math.round(nowMin))} · {passedPercent}% · {remainingHours}h left
                    </span>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="flex items-center justify-between border-t border-white/[0.08] px-4 py-2 bg-surface/30 backdrop-blur-sm text-[11px] text-muted shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Trees at the bottom of each day grow with your completed focus sessions</span>
          </span>
          <span className="text-[10px] text-muted/75">Click session to focus · Drag to schedule</span>
        </div>
      )}

      {popoverItem && (
        <ItemDetailPopover
          item={popoverItem.item}
          anchorRect={popoverItem.anchorRect}
          onClose={() => setPopoverItem(null)}
          onToggleComplete={(item) => {
            onToggleTask?.(item)
            setPopoverItem((prev) => (prev ? { ...prev, item: { ...prev.item, done: !prev.item.done } } : null))
          }}
          onStartFocus={(item) => {
            onOpenSlot?.({
              label: item.text || item.title,
              startMin: nowMin,
              endMin: Math.min(nowMin + 30, DAY_END_MIN),
              color: '#f59e0b',
            })
          }}
          onDelete={(item) => {
            onDeleteTask?.(item.id)
            setPopoverItem(null)
          }}
        />
      )}
    </div>
  )
}
