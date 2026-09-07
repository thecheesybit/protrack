import { useRef, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Plus, ChevronLeft, ChevronRight, Sparkles, Flag, Check, X } from 'lucide-react'
import { DAYS, DAY_FULL, todayDow, minutesToLabel, durationLabel, isSlotOnDay, snap } from '@/lib/time'
import { getWeekDate, ymd } from '@/lib/dates'
import { classifyDeadline } from '@/lib/deadlines'
import { useNowMinutes } from '@/hooks/useNowMinutes'
import { cn } from '@/utils/cn'

// -------------------------------------------------------------------
// Mini-timeline constants
// The compact preview covers 6 AM → midnight (1 080 min).
// At PX_PER_MIN = 0.30, that is 324 px — fits comfortably in the
// non-maximized widget without a scrollbar on most displays.
// -------------------------------------------------------------------
const PX = 0.65
const START = 6 * 60   // 06:00 in minutes-from-midnight
const END = 24 * 60    // 24:00 (midnight)
const TOTAL_H = (END - START) * PX  // 702 px

// Every hour tick from 6 AM to 11 PM
const HOUR_TICKS = Array.from({ length: 18 }, (_, i) => 6 + i)

function toTop(min) {
  return (Math.max(START, Math.min(END, min)) - START) * PX
}

function yToMin(clientY, rect) {
  const y = clientY - rect.top
  const rawMin = START + y / PX
  return Math.max(START, Math.min(END, snap(rawMin, 5)))
}

function slotHeight(slot) {
  return Math.max(22, (slot.endMin - slot.startMin) * PX)
}

/** Hex color → rgba string */
function rgba(hex, a) {
  const h = (hex || '#6366f1').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** Clear "12 PM" / "9 AM" label for the axis. */
function axisLabel(h) {
  if (h === 12) return '12 PM'
  if (h === 0 || h === 24) return '12 AM'
  return h > 12 ? `${h - 12} PM` : `${h} AM`
}

/**
 * Mini day-view calendar shown when the Timetable widget is in the grid
 * (non-maximised). Includes interactive day navigation and session indicators
 * across all 7 days of the week so scheduled sessions are always discoverable.
 */
export function TodayAgenda({
  slots = [],
  events = [],
  dateTasks = [],
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
  const [drag, setDrag] = useState(null)
  const [tasksExpanded, setTasksExpanded] = useState(false)
  const nowMin = useNowMinutes()
  const scrollRef = useRef(null)

  const activeRefDate = useMemo(() => {
    const d = new Date()
    if (weekOffset !== 0) {
      d.setDate(d.getDate() + weekOffset * 7)
    }
    return d
  }, [weekOffset])

  const isSelectedToday = selectedDay === today && weekOffset === 0
  const selectedDate = useMemo(() => getWeekDate(selectedDay, activeRefDate), [selectedDay, activeRefDate])
  const selectedDateStr = useMemo(() => ymd(selectedDate), [selectedDate])

  const displayedSlots = useMemo(() => {
    return slots
      .filter((s) => isSlotOnDay(s, selectedDay))
      .sort((a, b) => a.startMin - b.startMin)
  }, [slots, selectedDay])

  const displayedAllDayTasks = useMemo(() => {
    return allTodos.filter((t) => {
      if (t.type === 'event') return false
      if (!t.dueAt) return isSelectedToday
      const d = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
      if (isNaN(d.getTime())) return false
      return ymd(d) === selectedDateStr
    })
  }, [allTodos, isSelectedToday, selectedDateStr])

  const displayedEvents = useMemo(() => {
    return events
      .filter((e) => {
        const eDateStr =
          e.eventDate ||
          (e.dueAt ? ymd(e.dueAt?.toDate ? e.dueAt.toDate() : new Date(e.dueAt)) : null)
        return eDateStr === selectedDateStr
      })
      .sort((a, b) => {
        const aStart =
          a.eventStartMin ??
          (a.dueAt ? (a.dueAt?.toDate ? a.dueAt.toDate() : new Date(a.dueAt)).getHours() * 60 : 0)
        const bStart =
          b.eventStartMin ??
          (b.dueAt ? (b.dueAt?.toDate ? b.dueAt.toDate() : new Date(b.dueAt)).getHours() * 60 : 0)
        return aStart - bStart
      })
  }, [events, selectedDateStr])

  const displayedTasks = useMemo(() => {
    return dateTasks
      .filter((t) => {
        if (!t.dueAt || t.allDay) return false
        const d = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
        if (isNaN(d.getTime())) return false
        if (ymd(d) !== selectedDateStr) return false
        const mins = d.getHours() * 60 + d.getMinutes()
        return mins >= START
      })
      .sort((a, b) => {
        const da = a.dueAt?.toDate ? a.dueAt.toDate() : new Date(a.dueAt)
        const db = b.dueAt?.toDate ? b.dueAt.toDate() : new Date(b.dueAt)
        return da - db
      })
  }, [dateTasks, selectedDateStr])

  // Track which days of the week have sessions, events, or tasks
  const daysWithItems = useMemo(() => {
    const set = new Set()
    for (let d = 0; d < 7; d++) {
      const dStr = ymd(getWeekDate(d, activeRefDate))
      const isDToday = d === today && weekOffset === 0
      if (
        slots.some((s) => isSlotOnDay(s, d)) ||
        events.some((e) => {
          const ed =
            e.eventDate || (e.dueAt ? ymd(e.dueAt?.toDate ? e.dueAt.toDate() : new Date(e.dueAt)) : null)
          return ed === dStr
        }) ||
        allTodos.some((t) => {
          if (t.type === 'event') return false
          if (!t.dueAt) return isDToday
          const dt = t.dueAt?.toDate ? t.dueAt.toDate() : new Date(t.dueAt)
          return !isNaN(dt.getTime()) && ymd(dt) === dStr
        })
      ) {
        set.add(d)
      }
    }
    return set
  }, [slots, events, allTodos, today, activeRefDate, weekOffset])

  const handlePrevDay = () => {
    if (selectedDay === 0) {
      setWeekOffset((w) => w - 1)
      setSelectedDay(6)
    } else {
      setSelectedDay((d) => d - 1)
    }
  }

  const handleNextDay = () => {
    if (selectedDay === 6) {
      setWeekOffset((w) => w + 1)
      setSelectedDay(0)
    } else {
      setSelectedDay((d) => d + 1)
    }
  }

  const handleJumpToday = () => {
    setWeekOffset(0)
    setSelectedDay(today)
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    // Don't drag if clicking interactive elements inside the grid
    if (e.target.closest('button, a, [data-interactive="true"]')) return

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const min = yToMin(e.clientY, rect)

    setDrag({
      start: min,
      current: min,
      active: false,
      pointerId: e.pointerId,
      target: e.currentTarget,
    })
  }

  const onPointerMove = (e) => {
    if (!drag) return
    const rect = (drag.target || e.currentTarget).getBoundingClientRect()
    const min = yToMin(e.clientY, rect)
    const moved = Math.abs(min - drag.start) >= 5
    setDrag((d) => (d ? { ...d, current: min, active: d.active || moved } : d))
  }

  const onPointerUp = (e) => {
    if (!drag) return
    try {
      (drag.target || e?.currentTarget)?.releasePointerCapture?.(drag.pointerId ?? e?.pointerId)
    } catch {
      /* ignore */
    }

    const rawStart = Math.min(drag.start, drag.current)
    const rawEnd = Math.max(drag.start, drag.current)
    const wasRangeDrag = drag.active && (rawEnd - rawStart >= 10)
    setDrag(null)

    if (wasRangeDrag) {
      const startMin = Math.max(START, rawStart)
      const endMin = Math.min(END, rawEnd)
      if (onSelect) {
        onSelect({ dayIndex: selectedDay, startMin, endMin })
      } else if (onAdd) {
        onAdd(startMin, endMin, selectedDay)
      }
    } else {
      // Single tap/click: clean 1-hour slot starting at clicked minute
      const startMin = Math.max(START, Math.min(END - 30, rawStart))
      const endMin = Math.min(startMin + 60, END)
      if (onSelect) {
        onSelect({ dayIndex: selectedDay, startMin, endMin })
      } else if (onAdd) {
        onAdd(startMin, endMin, selectedDay)
      }
    }
  }

  const onPointerCancel = (e) => {
    if (!drag) return
    try {
      (drag.target || e?.currentTarget)?.releasePointerCapture?.(drag.pointerId ?? e?.pointerId)
    } catch {
      /* ignore */
    }
    setDrag(null)
  }

  // Find next upcoming session in the week
  const nextSession = useMemo(() => {
    if (slots.length === 0) return null
    for (let offset = 0; offset < 7; offset++) {
      const d = (today + offset) % 7
      const daySlots = slots
        .filter((s) => isSlotOnDay(s, d))
        .sort((a, b) => a.startMin - b.startMin)

      if (offset === 0) {
        const upcoming = daySlots.find((s) => s.endMin > nowMin)
        if (upcoming) return { day: d, slot: upcoming, isToday: true }
      } else if (daySlots.length > 0) {
        return { day: d, slot: daySlots[0], isToday: false }
      }
    }
    return null
  }, [slots, today, nowMin])

  const nowTop = toTop(nowMin)
  const nowVisible = isSelectedToday && nowMin >= START && nowMin <= END

  // Auto-scroll so "now" or first session is in comfortable view with top padding
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (nowVisible) {
      el.scrollTop = Math.max(0, nowTop - 70)
    } else if (displayedSlots.length > 0) {
      const firstTop = toTop(displayedSlots[0].startMin)
      el.scrollTop = Math.max(0, firstTop - 50)
    } else {
      el.scrollTop = 0
    }
  }, [selectedDay, nowVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── Day navigation & action row ── */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevDay}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            title="Previous day"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="text-xs font-bold text-ink">
            {DAY_FULL[selectedDay]}, {selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>

          {isSelectedToday ? (
            <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
              Today
            </span>
          ) : (
            <button
              onClick={handleJumpToday}
              className="rounded-md bg-surface-2/80 px-1.5 py-0.5 text-[9px] font-medium text-muted hover:text-ink hover:bg-surface-3 transition-colors"
              title="Jump back to today"
            >
              Today
            </button>
          )}

          <button
            onClick={handleNextDay}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            title="Next day"
            aria-label="Next day"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={() => {
            const startMin = nowVisible ? Math.min(nowMin, END - 60) : START + 3 * 60
            if (onSelect) {
              onSelect({ dayIndex: selectedDay, startMin, endMin: startMin + 60 })
            } else if (onAdd) {
              onAdd(startMin, startMin + 60, selectedDay)
            }
          }}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {/* ── Mini 7-day strip (Mon - Sun) with session/event/task indicator dots and dates ── */}
      <div className="grid grid-cols-7 gap-1 shrink-0 rounded-xl border border-line/40 bg-surface-2/30 p-1">
        {DAYS.map((name, idx) => {
          const isSelected = selectedDay === idx
          const isCurrentDay = today === idx && weekOffset === 0
          const hasItems = daysWithItems.has(idx)
          const dayDate = getWeekDate(idx, activeRefDate)
          const dateNum = dayDate.getDate()

          return (
            <button
              key={name}
              onClick={() => setSelectedDay(idx)}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-lg py-1 px-0.5 transition-all select-none',
                isSelected
                  ? 'bg-accent/20 text-accent font-bold shadow-sm'
                  : 'text-muted hover:bg-surface hover:text-ink',
                isCurrentDay && !isSelected && 'text-ink font-bold',
              )}
              title={`${DAY_FULL[idx]}, ${dayDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}${hasItems ? ' (scheduled items)' : ''}`}
            >
              <span className="text-[10px] font-medium leading-tight">{name}</span>
              <span
                className={cn(
                  'text-xs font-bold leading-tight mt-0.5 tabular-nums',
                  isSelected
                    ? 'text-accent scale-105'
                    : isCurrentDay
                    ? 'text-ink'
                    : 'text-muted/80',
                )}
              >
                {dateNum}
              </span>
              <span
                className={cn(
                  'h-1 w-1 rounded-full mt-0.5 transition-all',
                  hasItems ? 'bg-accent opacity-100 scale-100' : 'opacity-0 scale-50',
                )}
              />
            </button>
          )
        })}
      </div>

      {/* ── Collapsible Tasks & Todos Section for Selected Day ── */}
      <div className="shrink-0 rounded-xl border border-line/40 bg-surface-2/30 px-2 py-1.5 transition-all">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setTasksExpanded((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-ink transition-colors"
            title={tasksExpanded ? 'Collapse tasks' : 'Expand tasks'}
          >
            <Check className="h-3 w-3 text-accent" />
            <span>{isSelectedToday ? "Today's Tasks & Todos" : `Tasks · ${DAY_FULL[selectedDay]}`}</span>
            <span className="rounded-full bg-surface-3 px-1.5 py-0.2 text-[9px] font-semibold text-ink">
              {displayedAllDayTasks.length}
            </span>
            <span className="text-[9px] font-normal text-accent/80 hover:text-accent">
              {tasksExpanded ? '▴ Hide' : '▾ View'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (onSelect) {
                onSelect({ dayIndex: selectedDay, startMin: 9 * 60, endMin: 10 * 60 })
              }
            }}
            className="flex items-center gap-0.5 text-[10px] font-semibold text-accent hover:underline"
          >
            <Plus className="h-2.5 w-2.5" /> Add Task
          </button>
        </div>

        {tasksExpanded && (
          <div className="mt-2 flex flex-col gap-1.5 border-t border-line/30 pt-2 max-h-32 overflow-y-auto">
            {displayedAllDayTasks.length === 0 ? (
              <p className="text-[10px] text-muted italic px-1">No tasks recorded for this day.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {displayedAllDayTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenSlot?.({
                        label: t.text || t.title,
                        startMin: nowMin,
                        endMin: Math.min(nowMin + 30, END),
                        color: '#f59e0b',
                      })
                    }}
                    className="group flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200 hover:bg-amber-500/20 transition-all cursor-pointer shadow-xs"
                    title={`${t.text || t.title} · click to focus`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleTask?.(t)
                      }}
                      className="shrink-0 hover:opacity-80"
                      title={t.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      <Check className={cn('h-2.5 w-2.5', t.done ? 'text-emerald-400' : 'text-amber-300 opacity-60 hover:opacity-100')} />
                    </button>
                    <span className={cn('truncate max-w-[140px]', t.done && 'line-through opacity-60')}>
                      {t.text || t.title}
                    </span>
                    {onDeleteTask && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteTask(t.id)
                        }}
                        className="ml-0.5 text-amber-300 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                        title="Delete task"
                      >
                        <X className="h-2 w-2" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Mini timeline with Botanical Forest Border ── */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line/30 bg-surface/30">
        <div
          ref={scrollRef}
          className="h-full w-full overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-white/15 hover:scrollbar-thumb-white/25 pb-20"
        >
          <div className="relative flex min-w-0" style={{ height: TOTAL_H }}>

            {/* Time axis */}
            <div className="relative w-12 shrink-0 select-none py-1">
              {HOUR_TICKS.map((h) => (
                <span
                  key={h}
                  className="absolute right-2 text-[10px] font-semibold tabular-nums text-muted/80"
                  style={{ top: toTop(h * 60) - 6 }}
                >
                  {axisLabel(h)}
                </span>
              ))}
            </div>

          {/* Grid column — hour lines + slot blocks + events + tasks + now indicator */}
          <div
            className="relative flex-1 cursor-crosshair border-l border-line/25 select-none touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            {/* Drag selection ghost */}
            {drag && (
              <div
                className="pointer-events-none absolute inset-x-1.5 z-30 rounded-xl border-2 border-dashed border-accent bg-accent/20 backdrop-blur-xs flex flex-col justify-between p-2 shadow-lg"
                style={{
                  top: toTop(Math.min(drag.start, drag.current)),
                  height: Math.max(
                    26,
                    (Math.max(drag.start, drag.current) - Math.min(drag.start, drag.current)) * PX,
                  ),
                }}
              >
                <div className="flex items-center justify-between text-[11px] font-bold text-accent">
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-white backdrop-blur-sm shadow-xs">
                    {minutesToLabel(Math.min(drag.start, drag.current))}
                  </span>
                  <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    {durationLabel(Math.min(drag.start, drag.current), Math.max(drag.start, drag.current))}
                  </span>
                  <span className="rounded bg-black/60 px-1.5 py-0.5 text-white backdrop-blur-sm shadow-xs">
                    {minutesToLabel(Math.max(drag.start, drag.current))}
                  </span>
                </div>
                {Math.abs(drag.current - drag.start) >= 30 && (
                  <span className="text-[10px] text-accent font-semibold text-center select-none drop-shadow-sm">
                    Release to schedule / focus
                  </span>
                )}
              </div>
            )}

            {/* Hour grid lines */}
            {HOUR_TICKS.map((h) => (
              <div
                key={h}
                className="pointer-events-none absolute left-0 right-0 border-t border-line/20"
                style={{ top: toTop(h * 60) }}
              />
            ))}

            {/* Half-hour faint lines (every 2 h midpoint) */}
            {HOUR_TICKS.map((h) => (
              <div
                key={`h-${h}`}
                className="pointer-events-none absolute left-0 right-0 border-t border-line/10"
                style={{ top: toTop(h * 60 + 60) }}
              />
            ))}

            {/* Slot blocks */}
            {displayedSlots.map((slot) => {
              const top = toTop(slot.startMin)
              const height = slotHeight(slot)
              const showTime = height >= 22
              const showDuration = height >= 32

              return (
                <button
                  key={slot.id}
                  onClick={(e) => { e.stopPropagation(); onOpenSlot(slot) }}
                  title={`${slot.label || 'Session'} · ${minutesToLabel(slot.startMin)} – ${minutesToLabel(slot.endMin)}`}
                  className="group absolute inset-x-1 overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-left text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98]"
                  style={{
                    top,
                    height,
                    background: rgba(slot.color, 0.82),
                    borderLeftColor: slot.color,
                  }}
                >
                  <span className="block truncate text-[9px] font-semibold leading-tight">
                    {slot.label || 'Session'}
                  </span>
                  {showTime && (
                    <span className="block text-[8px] leading-tight opacity-80">
                      {minutesToLabel(slot.startMin)}
                      {showDuration && ` · ${durationLabel(slot.startMin, slot.endMin)}`}
                    </span>
                  )}
                </button>
              )
            })}

            {/* One-time event blocks */}
            {displayedEvents.map((event) => {
              const startMin = event.eventStartMin ?? 0
              const endMin = event.eventEndMin ?? startMin + 60
              const top = toTop(startMin)
              const height = Math.max(18, (endMin - startMin) * PX)

              return (
                <div
                  key={event.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenSlot?.({
                      label: event.text,
                      startMin,
                      endMin,
                      color: '#8b5cf6',
                    })
                  }}
                  title={`${event.text} · ${minutesToLabel(startMin)} – ${minutesToLabel(endMin)} · click to focus`}
                  className="group absolute inset-x-1 z-10 flex flex-col justify-between overflow-hidden rounded-md border border-violet-500/40 bg-violet-500/25 px-1.5 py-0.5 text-left text-white shadow-sm transition-all hover:bg-violet-500/35 cursor-pointer"
                  style={{ top, height }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex min-w-0 items-center gap-1 truncate text-[9px] font-semibold text-violet-200">
                      <Sparkles className="h-2.5 w-2.5 shrink-0 text-violet-400" />
                      <span className="truncate">{event.text}</span>
                    </span>
                    {onDeleteEvent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteEvent(event.id)
                        }}
                        className="rounded p-0.5 text-violet-300 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                        title="Delete event"
                        aria-label="Delete event"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  {height >= 26 && (
                    <span className="text-[8px] leading-tight text-violet-300/80">
                      {minutesToLabel(startMin)}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Deadline chips */}
            {displayedTasks.map((item) => {
              const d2 = item.dueAt?.toDate ? item.dueAt.toDate() : new Date(item.dueAt)
              let mins = d2.getHours() * 60 + d2.getMinutes()
              if (mins < START) mins = START
              if (mins > END) mins = END - 15
              const top = toTop(mins)
              const urgency = classifyDeadline(item.dueAt)
              const isOverdue = urgency === 'overdue'

              return (
                <div
                  key={item.id}
                  onClick={(e) => e.stopPropagation()}
                  title={`${item.text || item.title} (due)`}
                  className={cn(
                    'group absolute right-1 z-20 flex max-w-[85%] items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-semibold shadow transition-all hover:scale-105',
                    isOverdue ? 'bg-rose-500/95 text-white' : 'bg-amber-400/95 text-black',
                  )}
                  style={{ top: Math.max(0, top - 6) }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleTask?.(item)
                    }}
                    className="shrink-0 hover:opacity-80"
                    title={item.done ? 'Mark incomplete' : 'Mark complete'}
                    aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
                  >
                    <Check
                      className={cn(
                        'h-2 w-2',
                        item.done ? 'opacity-100' : 'opacity-40 hover:opacity-100',
                      )}
                    />
                  </button>
                  <span className={cn('truncate', item.done && 'line-through opacity-70')}>
                    {item.text || item.title}
                  </span>
                  {onDeleteTask && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteTask(item.id)
                      }}
                      className="ml-0.5 opacity-0 transition-opacity hover:text-rose-700 group-hover:opacity-100"
                      title="Delete task"
                      aria-label="Delete task"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  )}
                </div>
              )
            })}

            {/* Now indicator — dot + red line (only shown when viewing today) */}
            {nowVisible && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-10"
                style={{ top: nowTop }}
              >
                <div className="flex items-center">
                  <span className="h-2 w-2 shrink-0 -translate-x-[5px] rounded-full bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.7)]" />
                  <span className="h-px flex-1 bg-rose-500/70" />
                </div>
              </div>
            )}

            {/* Empty-state hint */}
            {displayedSlots.length === 0 && displayedEvents.length === 0 && displayedTasks.length === 0 && displayedAllDayTasks.length === 0 && (
              <div
                className="pointer-events-none absolute inset-x-2 flex flex-col items-center justify-center gap-2 p-3 text-center"
                style={{ top: nowVisible ? nowTop + 8 : TOTAL_H / 2 - 32 }}
              >
                <span className="rounded-full bg-surface-2/90 border border-line/40 px-3 py-1 text-[10px] text-muted font-medium backdrop-blur-sm shadow-sm">
                  No items on {DAY_FULL[selectedDay]} — tap + Add
                </span>
                {nextSession && nextSession.day !== selectedDay && (
                  <button
                    onClick={() => setSelectedDay(nextSession.day)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent hover:bg-accent/20 transition-colors shadow-sm"
                  >
                    Next: {DAYS[nextSession.day]} {minutesToLabel(nextSession.slot.startMin)} ({nextSession.slot.label || 'Session'}) →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

        {/* ── Botanical Forest: Shrubs along bottom border + Pop-up Tree on right ── */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 z-20 flex items-end select-none">
          {/* Shrub foliage border along the entire bottom with natural, unclipped organic silhouettes */}
          <img
            src="/forest/shrubs-border.png"
            alt="Forest shrubs border"
            className="pointer-events-none h-16 w-full object-cover object-bottom opacity-90 drop-shadow-[0_-2px_10px_rgba(0,0,0,0.4)]"
          />

          {/* Lush Hero Tree popping up on top of the timeline on the right */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            className="pointer-events-auto absolute -bottom-1 right-2 z-30 flex flex-col items-center group/tree cursor-pointer"
            title={`🌲 Focus Forest · ${sessions.filter((s) => s.completed !== false && ymd(s.startedAt?.toDate ? s.startedAt.toDate() : new Date(s.startedAt)) === selectedDateStr).length} focus sessions`}
          >
            <img
              src="/forest/tree-hero.png"
              alt="Daily Focus Tree"
              className="h-32 w-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover/tree:scale-105"
            />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
