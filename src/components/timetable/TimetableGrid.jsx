import { useState } from 'react'
import { Pencil, Flag } from 'lucide-react'
import { isDueToday, dueAtToMinutes, classifyDeadline } from '@/lib/deadlines'
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

function SlotBlock({ slot, onOpen, onEdit }) {
  const top = (slot.startMin - DAY_START_MIN) * PX_PER_MIN
  const height = (slot.endMin - slot.startMin) * PX_PER_MIN

  // Custom styles for visual differentiation
  const isStriped = slot.tagStyle === 'striped' || (!slot.tagStyle && slot.tag?.toLowerCase().includes('lab'))
  const isDashed = slot.tagStyle === 'dashed' || (!slot.tagStyle && slot.tag?.toLowerCase().includes('revision'))
  const isDotted = slot.tagStyle === 'dotted'

  const bgStyle = isStriped
    ? `repeating-linear-gradient(45deg, ${hexA(slot.color, 0.7)}, ${hexA(slot.color, 0.7)} 10px, ${hexA(slot.color, 0.9)} 10px, ${hexA(slot.color, 0.9)} 20px)`
    : hexA(slot.color, 0.85)

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      className={cn(
        "group/slot absolute inset-x-1 cursor-pointer overflow-hidden rounded-lg border-l-4 px-2 py-1 text-white shadow-sm transition-transform hover:z-10 hover:scale-[1.02]",
        isDashed && "border-2 border-dashed",
        isDotted && "border-2 border-dotted",
      )}
      style={{
        top,
        height,
        background: bgStyle,
        borderColor: slot.color,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate text-xs font-semibold leading-tight">
          {slot.label || 'Session'}
          {slot.tag && (
            <span className="ml-1.5 inline-block rounded bg-black/30 px-1 text-[9px] font-normal uppercase tracking-wider text-white">
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
          className="shrink-0 opacity-0 transition-opacity group-hover/slot:opacity-100"
          aria-label="Edit session"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      {height > 30 && (
        <span className="text-[10px] opacity-90">{minutesToLabel(slot.startMin)}</span>
      )}
    </div>
  )
}

/** Chip showing a dated todo or task on the today column. */
function TodoChip({ item, topPx }) {
  const urgency = classifyDeadline(item.dueAt)
  const isOverdue = urgency === 'overdue'
  return (
    <div
      title={item.text || item.title}
      className={cn(
        'absolute right-0.5 z-10 flex max-w-[90%] cursor-default items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold shadow-sm',
        isOverdue ? 'bg-rose-500/90 text-white' : 'bg-amber-400/90 text-black',
      )}
      style={{ top: topPx - 8 }}
    >
      <Flag className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{item.text || item.title}</span>
    </div>
  )
}

/** Full weekly grid with pointer drag-to-create + click-to-capture. */
export function TimetableGrid({
  slots,
  defaultColor,
  onCreate,
  onOpenSlot,
  onEditSlot,
  onQuickCapture,
  dateTasks = [],
}) {
  const [drag, setDrag] = useState(null)
  const today = todayDow()
  const nowMin = useNowMinutes()
  const nowVisible = nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN

  const hours = []
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 60) hours.push(m)

  const onDown = (day) => (e) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const min = yToMin(e.clientY, e.currentTarget.getBoundingClientRect())
    setDrag({ day, start: min, current: min })
  }
  const onMove = (e) => {
    if (!drag) return
    const min = yToMin(e.clientY, e.currentTarget.getBoundingClientRect())
    setDrag((d) => (d ? { ...d, current: min } : d))
  }
  const onUp = () => {
    if (!drag) return
    const startMin = Math.min(drag.start, drag.current)
    const endMin = Math.max(drag.start, drag.current)
    const day = drag.day
    setDrag(null)
    if (endMin - startMin >= MIN_SLOT) {
      onCreate({ dayOfWeek: day, startMin, endMin, label: '', color: defaultColor })
    } else {
      // A tap (no meaningful drag) opens natural-language quick capture.
      onQuickCapture?.({ dayOfWeek: day, startMin })
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex border-b border-line/60 pb-2 pl-12">
        {DAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              'flex-1 text-center text-xs font-medium',
              i === today ? 'text-accent' : 'text-muted',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: GRID_H }}>
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
          </div>

          <div className="relative flex flex-1">
            {hours.map((m) => (
              <div
                key={m}
                className="pointer-events-none absolute left-0 right-0 border-t border-line/40"
                style={{ top: (m - DAY_START_MIN) * PX_PER_MIN }}
              />
            ))}

            {DAYS.map((d, day) => (
              <div
                key={d}
                onPointerDown={onDown(day)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                className={cn(
                  'relative flex-1 touch-none border-l border-line/30',
                  day === today && 'bg-accent/5',
                )}
              >
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

                {day === today &&
                  dateTasks
                    .filter((t) => isDueToday(t.dueAt))
                    .map((t) => {
                      const mins = dueAtToMinutes(t.dueAt)
                      if (mins === null || mins < DAY_START_MIN || mins > DAY_END_MIN) return null
                      return (
                        <TodoChip
                          key={t.id}
                          item={t}
                          topPx={(mins - DAY_START_MIN) * PX_PER_MIN}
                        />
                      )
                    })}

                {drag && drag.day === day && (
                  <div
                    className="pointer-events-none absolute inset-x-1 rounded-lg border-2 border-dashed border-accent bg-accent/15"
                    style={{
                      top: (Math.min(drag.start, drag.current) - DAY_START_MIN) * PX_PER_MIN,
                      height: Math.abs(drag.current - drag.start) * PX_PER_MIN,
                    }}
                  />
                )}
              </div>
            ))}

            {/* Live "now" flag + chrono-passage indicator. */}
            {nowVisible && (() => {
              const passedPercent = Math.round(((nowMin - DAY_START_MIN) / TOTAL_MIN) * 100)
              const remainingHours = ((DAY_END_MIN - nowMin) / 60).toFixed(1)
              const nowTop = (nowMin - DAY_START_MIN) * PX_PER_MIN
              return (
                <>
                  {/* Today's column — elapsed time overlay gradient */}
                  <div
                    className="pointer-events-none absolute z-[5]"
                    style={{
                      left: `${(today / 7) * 100}%`,
                      width: `${(1 / 7) * 100}%`,
                      top: 0,
                      height: nowTop,
                      background: 'linear-gradient(to bottom, rgba(16,185,129,0.04), rgba(245,158,11,0.06), rgba(244,63,94,0.08))',
                      borderBottom: '2px solid rgba(244,63,94,0.3)',
                    }}
                  />
                  {/* Now line spanning all columns */}
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 flex items-center gap-1"
                    style={{ top: nowTop }}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)] animate-pulse" />
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

      <p className="border-t border-line/60 pt-2 text-center text-[11px] text-muted">
        Drag to block · click to capture · click a session to focus
      </p>
    </div>
  )
}
