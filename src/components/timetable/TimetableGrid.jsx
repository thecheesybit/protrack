import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { Pencil, Sparkles, X, Check, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react'
import { classifyDeadline } from '@/lib/deadlines'
import { NoteDeadlineChip } from './NoteDeadlineChip'
import { ItemDetailPopover } from './ItemDetailPopover'
import { getWeekDate, ymd } from '@/lib/dates'
import { DayGrove } from '@/components/focus/CalendarForest'
import {
  DAYS,
  DAY_START_MIN,
  DAY_END_MIN,
  GRID_END_MIN,
  GRID_SPAN_MIN,
  PX_PER_MIN,
  MIN_SLOT,
  todayDow,
  minutesToAxis,
  minutesToLabel,
  snap,
  isSlotOnDay,
  toAxisMin,
} from '@/lib/time'
import { useNowMinutes } from '@/hooks/useNowMinutes'
import { cn } from '@/utils/cn'

const TOTAL_MIN = GRID_END_MIN - DAY_START_MIN

// Tick arrays — computed once. The axis runs a full 24h loop (06:00 → 06:00).
const hours = []
for (let m = DAY_START_MIN; m <= GRID_END_MIN; m += 60) hours.push(m)

const halfHours = []
for (let m = DAY_START_MIN + 30; m < GRID_END_MIN; m += 60) halfHours.push(m)

// ── Helpers ───────────────────────────────────────────────────────────────────

// Pointer Y → axis minute, clamped to the visible span (06:00 → 30:00) so the
// post-midnight band stays draggable.
function yToMin(clientY, rect, ppm = PX_PER_MIN) {
  const raw = snap(DAY_START_MIN + (clientY - rect.top) / ppm, 5)
  return Math.max(DAY_START_MIN, Math.min(GRID_END_MIN, raw))
}

/**
 * Turn an axis-minute range picked on weekday column `day` into the real
 * { dayIndex, startMin, endMin } the slot editor stores. A pick that begins
 * after midnight lands on the NEXT weekday's early morning; a single pick is
 * kept on one side of the midnight wrap so it maps to one clean triple.
 */
function axisRangeToSelection(day, axisStart, axisEnd) {
  const startsNextDay = axisStart >= GRID_SPAN_MIN // >= 24:00 on the axis
  const off = startsNextDay ? GRID_SPAN_MIN : 0
  const hiCap = startsNextDay ? GRID_END_MIN : GRID_SPAN_MIN
  const lo = axisStart - off
  const hi = Math.min(axisEnd, hiCap) - off
  return {
    dayIndex: startsNextDay ? (day + 1) % 7 : day,
    startMin: lo,
    endMin: Math.max(lo + 5, hi),
    dayCap: hiCap - off, // 06:00 for the tail, 24:00 otherwise
  }
}

function hexA(hex, a) {
  const h = (hex || '#6366f1').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// ── Block components ──────────────────────────────────────────────────────────

const SlotBlock = memo(function SlotBlock({
  slot,
  isDone = false,
  onOpen,
  onEdit,
  onToggleDone,
  ppm = PX_PER_MIN,
}) {
  const startAxis = toAxisMin(slot.startMin)
  let endAxis = toAxisMin(slot.endMin)
  if (endAxis <= startAxis) endAxis += GRID_SPAN_MIN // slot runs past midnight
  const top = (startAxis - DAY_START_MIN) * ppm
  const height = Math.max(26, (endAxis - startAxis) * ppm)

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
    : hexA(accent, isDone ? 0.45 : 0.82)

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      className={cn(
        'group/slot absolute inset-x-1 cursor-pointer overflow-hidden rounded-xl px-2.5 py-1.5 text-white shadow-sm transition-all hover:z-30 hover:scale-[1.02] hover:shadow-glow-sm backdrop-blur-md select-none',
        isDashed && 'border-2 border-dashed',
        isDotted && 'border-2 border-dotted',
        isDone && 'opacity-75 filter grayscale-[20%]',
      )}
      style={{
        top,
        height,
        background: bgStyle,
        borderLeft: `4px solid ${isDone ? '#10b981' : accent}`,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold leading-tight text-white drop-shadow-xs">
          {onToggleDone && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onToggleDone()
              }}
              className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded transition-all',
                isDone
                  ? 'bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-400/50'
                  : 'border border-white/60 bg-black/20 text-transparent hover:border-white hover:text-white group-hover/slot:border-white',
              )}
              title={isDone ? 'Mark incomplete' : 'Mark complete'}
              aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
            >
              <Check className={cn('h-2.5 w-2.5', isDone ? 'opacity-100 stroke-[3]' : 'opacity-0 hover:opacity-100')} />
            </button>
          )}
          <span className={cn('truncate', isDone && 'line-through opacity-75')}>
            {slot.label || 'Session'}
          </span>
          {slot.tag && (
            <span className="ml-1 inline-block rounded-md bg-black/35 px-1.5 py-0.2 text-[9px] font-medium tracking-wider text-white">
              {slot.tag}
            </span>
          )}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="shrink-0 opacity-0 transition-opacity group-hover/slot:opacity-100 text-white/80 hover:text-white p-0.5 rounded hover:bg-white/10"
            aria-label="Edit session"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      </div>
      {height > 30 && (
        <span className={cn('text-[10px] font-medium text-white/80 mt-0.5 block tabular-nums', isDone && 'line-through opacity-60')}>
          {minutesToLabel(slot.startMin)} – {minutesToLabel(slot.endMin)}
        </span>
      )}
    </div>
  )
})

/** One-time event block (todo with type='event'). */
const EventBlock = memo(function EventBlock({ event, onDelete, onOpen, ppm = PX_PER_MIN }) {
  const startMin =
    event.eventStartMin ??
    (event.dueAt ? (event.dueAt?.toDate ? event.dueAt.toDate() : new Date(event.dueAt)).getHours() * 60 : 0)
  const endMin = event.eventEndMin ?? startMin + 60
  const startAxis = toAxisMin(startMin)
  let endAxis = toAxisMin(endMin)
  if (endAxis <= startAxis) endAxis += GRID_SPAN_MIN // event runs past midnight
  const top = (startAxis - DAY_START_MIN) * ppm
  const height = Math.max(26, (endAxis - startAxis) * ppm)

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
  onToggleSlot,
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
  // The grid covers a full 24h loop (06:00 → 06:00), so "now" always maps onto the
  // axis; 00:00–05:59 wraps to the bottom band and belongs to the PREVIOUS
  // calendar day's column (its night tail).
  const nowAxis = toAxisMin(nowMin)
  const nowColIdx = nowMin < DAY_START_MIN ? (today + 6) % 7 : today
  // When it's past midnight on a Monday, the active 24h day sits in the previous
  // week's Sunday column — not rendered at weekOffset 0, so hide the marker.
  const nowVisible = weekOffset === 0 && !(nowMin < DAY_START_MIN && today === 0)

  // Zoom — pixels-per-minute multiplier. Persisted; 1× = the classic scale,
  // up to 4× so 9–10 AM opens into a clean minute-by-minute view.
  const ZOOM_STEPS = [0.75, 1, 1.5, 2, 3, 4]
  const [zoom, setZoom] = useState(() => {
    try {
      return Number(localStorage.getItem('protrack:timetable_zoom')) || 1
    } catch {
      return 1
    }
  })
  const ppm = PX_PER_MIN * zoom
  const gridH = TOTAL_MIN * ppm
  const setZoomAt = (z) => {
    const next = Math.min(4, Math.max(0.75, z))
    setZoom(next)
    try {
      localStorage.setItem('protrack:timetable_zoom', String(next))
    } catch {
      /* ignore */
    }
  }
  const stepZoom = (dir) => {
    const i = ZOOM_STEPS.findIndex((s) => s >= zoom - 0.001)
    setZoomAt(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))])
  }
  // Sub-hour gridlines get denser as you zoom in.
  const fineStep = zoom >= 3 ? 5 : zoom >= 1.5 ? 15 : 30
  const fineLines = useMemo(() => {
    const out = []
    for (let m = DAY_START_MIN; m <= GRID_END_MIN; m += fineStep) {
      if (m % 60 !== 0) out.push(m)
    }
    return out
  }, [fineStep])

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

  const todayDateStr = useMemo(() => ymd(new Date()), [])

  // The all-day / tasks shelf only earns its row when the visible week actually
  // has an all-day item, an untimed deadline, or an overdue carry-forward — an
  // empty strip just wastes the 6 AM row. Mirrors the per-column filters below.
  const weekHasTrayItems = useMemo(() => {
    const now = new Date()
    for (let day = 0; day < 7; day++) {
      const colDate = getWeekDate(day, activeRefDate)
      const colDateStr = ymd(colDate)
      const isCurrentToday = day === today && weekOffset === 0
      const todoHit = allTodos.some((t) => {
        if (t.type === 'event' || t.source === 'gcal' || !t.dueAt) return false
        const d2 = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
        if (isNaN(d2.getTime())) return false
        const isDone = Boolean(t.done) || t.column === 'done'
        const mins = d2.getHours() * 60 + d2.getMinutes()
        if (ymd(d2) === colDateStr) return Boolean(t.allDay) || mins === 0
        return isCurrentToday && !isDone && d2 < now
      })
      if (todoHit) return true
      const gcalHit = (gcalEvents || []).some((ev) => {
        if (!ev.allDay || !ev.startMs) return false
        const s = ymd(new Date(ev.startMs))
        const e = ev.endMs ? ymd(new Date(ev.endMs)) : s
        return colDateStr >= s && colDateStr <= e
      })
      if (gcalHit) return true
    }
    return false
  }, [allTodos, gcalEvents, activeRefDate, today, weekOffset])

  // Auto-scroll so current hour or earliest session is comfortably in view
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (nowVisible) {
      const nowTop = (nowAxis - DAY_START_MIN) * ppm
      el.scrollTop = Math.max(0, nowTop - el.clientHeight / 3)
    } else if (slots.length > 0) {
      const minStart = Math.min(...slots.map((s) => toAxisMin(s.startMin)))
      const top = (minStart - DAY_START_MIN) * ppm
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
    const min = yToMin(e.clientY, rect, ppm)
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
    const min = yToMin(e.clientY, rect, ppm)
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
    const aStart = Math.min(drag.start, drag.current)
    const aEnd = Math.max(drag.start, drag.current)
    const sel = axisRangeToSelection(drag.day, aStart, aEnd)
    setDrag(null)
    if (aEnd - aStart >= MIN_SLOT) {
      onSelect?.({ dayIndex: sel.dayIndex, startMin: sel.startMin, endMin: sel.endMin })
    } else {
      // Single tap/click on a cell: select a clean 1-hour slot at the clicked time
      const clickEnd = Math.min(sel.startMin + 60, sel.dayCap)
      onSelect?.({ dayIndex: sel.dayIndex, startMin: sel.startMin, endMin: clickEnd })
    }
  }

  const onContextMenu = (day) => (e) => {
    e.preventDefault()
    const a = yToMin(e.clientY, e.currentTarget.getBoundingClientRect(), ppm)
    const sel = axisRangeToSelection(day, a, a + 60)
    onSelect?.({ dayIndex: sel.dayIndex, startMin: sel.startMin, endMin: sel.endMin })
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
          {/* Zoom the time scale — up to 4× for a minute-level view */}
          <div className="mr-1 flex items-center rounded-lg border border-white/10 bg-surface-2/30">
            <button
              type="button"
              onClick={() => stepZoom(-1)}
              disabled={zoom <= 0.75}
              className="flex h-6 w-6 items-center justify-center text-muted hover:text-ink disabled:opacity-30"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setZoomAt(1)}
              className="px-1 text-[10px] font-mono tabular-nums text-muted hover:text-ink"
              title="Reset zoom"
            >
              {zoom % 1 === 0 ? `${zoom}×` : `${zoom.toFixed(1)}×`}
            </button>
            <button
              type="button"
              onClick={() => stepZoom(1)}
              disabled={zoom >= 4}
              className="flex h-6 w-6 items-center justify-center text-muted hover:text-ink disabled:opacity-30"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
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

      {/* Tactile Day Header Strip (Inspired by calendar.me) — past days greyed out (media_1788918321694.png) */}
      <div className="flex border-b border-white/[0.08] pb-2 pt-1.5 pl-12 pr-1 gap-1.5 shrink-0 bg-surface/20">
        {DAYS.map((d, i) => {
          const colDate = getWeekDate(i, activeRefDate)
          const dateNum = colDate.getDate()
          const colDateStr = ymd(colDate)
          const isToday = i === today && weekOffset === 0
          const isPastDay = colDateStr < todayDateStr && !isToday
          return (
            <div
              key={d}
              onClick={() => onPickDay?.(colDate)}
              title={`Open ${d} ${dateNum} in the day view${isPastDay ? ' (past day)' : ''}`}
              className={cn(
                'flex flex-1 flex-col items-center justify-center py-1.5 px-1 rounded-2xl border transition-all cursor-pointer select-none',
                isToday
                  ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-slate-950 font-bold shadow-glow-sm border-emerald-300 ring-2 ring-emerald-400/30'
                  : isPastDay
                    ? 'border-white/[0.03] bg-surface-2/15 text-muted/50 opacity-55 hover:opacity-80 hover:bg-surface-2/25'
                    : 'border-white/[0.06] bg-surface-2/25 text-muted hover:bg-surface-2/50 hover:text-ink hover:border-white/15',
              )}
            >
              <span className={cn('text-[10px] uppercase font-bold tracking-wider', isToday ? 'text-slate-950/80' : isPastDay ? 'text-muted/40' : 'text-muted')}>
                {d}
              </span>
              <span className={cn('text-base font-black tracking-tight tabular-nums mt-0.5', isToday ? 'text-slate-950' : isPastDay ? 'text-muted/60' : 'text-ink')}>
                {dateNum}
              </span>
            </div>
          )
        })}
      </div>

      {/* All-Day / Tasks shelf across the week — hidden entirely on an empty week
          so it never eats the 6 AM row. */}
      {weekHasTrayItems && (
      <div className="flex border-b border-line/50 pl-12 bg-surface-2/20 shrink-0 min-h-[30px] max-h-[58px]">
        {DAYS.map((d, day) => {
          const colDate = getWeekDate(day, activeRefDate)
          const colDateStr = ymd(colDate)
          const isCurrentToday = day === today && weekOffset === 0
          const isPastDay = colDateStr < todayDateStr && !isCurrentToday

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
            // A real early-morning time (00:01–05:59) now has a home on the grid —
            // the previous day's night tail — so it's no longer "untimed".
            const isUntimedOrMidnight = t.allDay || mins === 0
            if (isDueToday) return isUntimedOrMidnight
            // Display-only carry-forward for incomplete overdue items onto today
            if (isCurrentToday && !isDone && d2 < new Date()) return true
            return false
          })

          // All-day Google Calendar items (holidays, multi-day trips…) for this day.
          const dayAllDayGcal = gcalEvents.filter((ev) => {
            if (!ev.allDay || !ev.startMs) return false
            const s = ymd(new Date(ev.startMs))
            const e = ev.endMs ? ymd(new Date(ev.endMs)) : s
            return colDateStr >= s && colDateStr <= e
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
                isPastDay && 'bg-black/20 opacity-60',
              )}
              title={`Double-click to add an all-day item on ${d}`}
            >
              {dayAllDayGcal.map((ev) => (
                <a
                  key={ev.id}
                  href={ev.htmlLink || undefined}
                  target={ev.htmlLink ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-xs"
                  style={{ backgroundColor: ev.color || '#4285f4' }}
                  title={`${ev.title} · ${ev.calendarName}`}
                >
                  <span className="truncate">{ev.title}</span>
                </a>
              ))}
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
      )}

      {/* Scrollable grid body */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto pt-3">
        <div className="relative flex" style={{ height: gridH }}>

          {/* Time axis */}
          <div className="relative w-12 shrink-0">
            {hours.map((m) => (
              <div
                key={m}
                className="absolute right-0 -translate-y-1/2 pr-2 text-right text-[10px] text-muted"
                style={{ top: (m - DAY_START_MIN) * ppm }}
              >
                {minutesToAxis(m)}
              </div>
            ))}
            {fineLines.map((m) => (
              <div
                key={`fl-${m}`}
                className={cn('absolute right-2 border-t border-line/25', m % 30 === 0 ? 'w-1.5' : 'w-1')}
                style={{ top: (m - DAY_START_MIN) * ppm }}
              />
            ))}
            {zoom >= 2 &&
              fineLines
                .filter((m) => m % 15 === 0)
                .map((m) => (
                  <div
                    key={`fll-${m}`}
                    className="absolute right-3 -translate-y-1/2 text-right text-[8px] text-muted/60"
                    style={{ top: (m - DAY_START_MIN) * ppm }}
                  >
                    {minutesToLabel(m)}
                  </div>
                ))}
          </div>

          {/* Grid columns */}
          <div className="relative flex flex-1">
            {/* Hour grid lines */}
            {hours.map((m) => (
              <div
                key={m}
                className="pointer-events-none absolute left-0 right-0 border-t border-line/40"
                style={{ top: (m - DAY_START_MIN) * ppm }}
              />
            ))}
            {/* Sub-hour grid lines — denser as you zoom in */}
            {fineLines.map((m) => (
              <div
                key={`fl-${m}`}
                className={cn(
                  'pointer-events-none absolute left-0 right-0 border-t',
                  m % 30 === 0 ? 'border-line/15' : 'border-line/[0.07]',
                )}
                style={{ top: (m - DAY_START_MIN) * ppm }}
              />
            ))}

            {DAYS.map((d, day) => {
              const colDate = getWeekDate(day, activeRefDate)
              const colDateStr = ymd(colDate)
              const isCurrentDayToday = day === today && weekOffset === 0
              const isPastDay = colDateStr < todayDateStr && !isCurrentDayToday

              // This column's 24h span is [colDate 06:00 → nextDate 06:00). An item
              // with a real early-morning time (00:01–05:59) belongs to the
              // previous day's column, so this column also pulls the pre-06:00
              // slice of the NEXT calendar day. Midnight-exact / untimed items
              // stay on their nominal date.
              const tailDate = new Date(colDate)
              tailDate.setDate(tailDate.getDate() + 1)
              const tailDateStr = ymd(tailDate)
              const tailDayIdx = (day + 1) % 7
              const isTailMinute = (m) => m != null && m > 0 && m < DAY_START_MIN
              // date + minute-of-day → does this item render in this column?
              const inColumn = (dateStr, minute) =>
                isTailMinute(minute) ? dateStr === tailDateStr : dateStr === colDateStr

              return (
                <div
                  key={d}
                  onPointerDown={onDown(day)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onContextMenu={onContextMenu(day)}
                  className={cn(
                    'relative flex-1 touch-none border-l border-line/30 flex flex-col justify-between overflow-visible transition-colors',
                    isCurrentDayToday && 'bg-accent/5',
                    isPastDay && 'bg-black/25 opacity-65 backdrop-blur-[0.5px]',
                  )}
                >
                  {/* Recurring slots — early-morning ones surface in the prior day's tail */}
                  {slots
                    .filter((s) =>
                      isTailMinute(s.startMin)
                        ? isSlotOnDay(s, tailDayIdx, tailDate)
                        : isSlotOnDay(s, day, colDate),
                    )
                    .map((s) => {
                      const targetDate = isTailMinute(s.startMin) ? tailDate : colDate
                      const targetDateStr = ymd(targetDate)
                      const isDone =
                        Boolean(s.completedDates?.includes(targetDateStr)) ||
                        (Array.isArray(sessions) &&
                          sessions.some((sess) => {
                            if (!sess || sess.completed === false) return false
                            if (sess.slotId && sess.slotId === s.id) {
                              if (sess.targetDate) return sess.targetDate === targetDateStr
                              const d = sess.startedAt?.toDate ? sess.startedAt.toDate() : new Date(sess.startedAt)
                              return d && ymd(d) === targetDateStr
                            }
                            return false
                          }))
                      return (
                        <SlotBlock
                          key={s.id}
                          slot={s}
                          isDone={isDone}
                          ppm={ppm}
                          onOpen={() => onOpenSlot(s, targetDateStr)}
                          onEdit={() => onEditSlot(s)}
                          onToggleDone={() => onToggleSlot?.(s, targetDateStr)}
                        />
                      )
                    })}

                  {/* One-time event blocks */}
                  {events
                    .filter((e) => {
                      const ed = e.dueAt ? (e.dueAt?.toDate ? e.dueAt.toDate() : new Date(e.dueAt)) : null
                      const eDateStr = e.eventDate || (ed ? ymd(ed) : null)
                      if (!eDateStr) return false
                      const mins =
                        e.eventStartMin ?? (ed && !isNaN(ed.getTime()) ? ed.getHours() * 60 + ed.getMinutes() : null)
                      return inColumn(eDateStr, mins)
                    })
                    .map((e) => (
                      <EventBlock
                        key={e.id}
                        event={e}
                        ppm={ppm}
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
                      if (!t.dueAt || t.allDay) return false
                      const d2 = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
                      if (isNaN(d2.getTime())) return false
                      return inColumn(ymd(d2), d2.getHours() * 60 + d2.getMinutes())
                    })
                    .map((t, idx) => {
                      const d2 = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
                      let mins = toAxisMin(d2.getHours() * 60 + d2.getMinutes())
                      if (mins > GRID_END_MIN) mins = GRID_END_MIN - 15
                      return (
                        <TodoChip
                          key={t.id}
                          item={t}
                          topPx={(mins - DAY_START_MIN) * ppm + (idx % 2 === 1 ? 12 : 0)}
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
                      return inColumn(ymd(d2), d2.getHours() * 60 + d2.getMinutes())
                    })
                    .map((n, idx) => {
                      const d2 = n.dueAt?.toDate ? n.dueAt.toDate() : new Date(n.dueAt)
                      let mins = toAxisMin(d2.getHours() * 60 + d2.getMinutes())
                      if (mins > GRID_END_MIN) mins = GRID_END_MIN - 15
                      return (
                        <NoteDeadlineChip
                          key={n.id}
                          note={n}
                          topPx={(mins - DAY_START_MIN) * ppm + (idx % 2 === 1 ? 12 : 0)}
                          onOpen={onOpenNote}
                        />
                      )
                    })}

                  {/* Subject Kanban tasks that carry a day/time */}
                  {subjectTasks
                    .filter((t) => {
                      if (t.allDay) return false
                      const d2 = toDateSafe(t.dueAt)
                      if (!d2) return false
                      return inColumn(ymd(d2), d2.getHours() * 60 + d2.getMinutes())
                    })
                    .map((t, idx) => {
                      const d2 = toDateSafe(t.dueAt)
                      let mins = toAxisMin(d2.getHours() * 60 + d2.getMinutes())
                      if (mins > GRID_END_MIN) mins = GRID_END_MIN - 15
                      return (
                        <TodoChip
                          key={`st-${t.id}`}
                          item={{ ...t, text: t.title || t.text }}
                          topPx={(mins - DAY_START_MIN) * ppm + (idx % 2 === 1 ? 12 : 0)}
                          onToggle={onToggleSubjectTask}
                        />
                      )
                    })}

                  {/* Synced Google Calendar events — read-only, at their real time */}
                  {gcalEvents
                    .filter(
                      (ev) =>
                        !ev.allDay &&
                        typeof ev.startMin === 'number' &&
                        inColumn(ev.dateStr, ev.startMin),
                    )
                    .map((ev, idx) => {
                      let mins = toAxisMin(ev.startMin)
                      if (mins > GRID_END_MIN) mins = GRID_END_MIN - 15
                      return (
                        <GcalChip
                          key={ev.id}
                          ev={ev}
                          topPx={(mins - DAY_START_MIN) * ppm + (idx % 2 === 1 ? 11 : 0)}
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
                        let mins = toAxisMin(c.getHours() * 60 + c.getMinutes())
                        if (mins > GRID_END_MIN) mins = GRID_END_MIN - 15
                        return (
                          <UndatedMarker
                            key={t.id}
                            item={t}
                            n={idx + 1}
                            topPx={(mins - DAY_START_MIN) * ppm}
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
                          (Math.min(drag.start, drag.current) - DAY_START_MIN) * ppm,
                        height: Math.max(
                          MIN_SLOT * ppm,
                          Math.abs(drag.current - drag.start) * ppm,
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
              const passedPercent = Math.round(((nowAxis - DAY_START_MIN) / TOTAL_MIN) * 100)
              const remainingHours = ((GRID_END_MIN - nowAxis) / 60).toFixed(1)
              const nowTop = (nowAxis - DAY_START_MIN) * ppm
              return (
                <>
                  <div
                    className="pointer-events-none absolute z-[5]"
                    style={{
                      left: `${(nowColIdx / 7) * 100}%`,
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
