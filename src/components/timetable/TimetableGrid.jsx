import { useState } from 'react'
import { Pencil } from 'lucide-react'
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
} from '@/lib/time'
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
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onOpen}
      className="group/slot absolute inset-x-1 cursor-pointer overflow-hidden rounded-lg border-l-2 px-2 py-1 text-left text-white shadow-sm transition-transform hover:z-10 hover:scale-[1.02]"
      style={{ top, height, backgroundColor: hexA(slot.color, 0.85), borderColor: slot.color }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate text-xs font-semibold leading-tight">
          {slot.label || 'Session'}
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

/** Full weekly grid with pointer drag-to-create. */
export function TimetableGrid({ slots, defaultColor, onCreate, onOpenSlot, onEditSlot }) {
  const [drag, setDrag] = useState(null)
  const today = todayDow()

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
                  .filter((s) => s.dayOfWeek === day)
                  .map((s) => (
                    <SlotBlock
                      key={s.id}
                      slot={s}
                      onOpen={() => onOpenSlot(s)}
                      onEdit={() => onEditSlot(s)}
                    />
                  ))}

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
          </div>
        </div>
      </div>

      <p className="border-t border-line/60 pt-2 text-center text-[11px] text-muted">
        Drag on a day to create · click a session to focus
      </p>
    </div>
  )
}
