import { useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { DAY_FULL, todayDow, minutesToLabel, durationLabel, isSlotOnDay, snap } from '@/lib/time'
import { useNowMinutes } from '@/hooks/useNowMinutes'

// -------------------------------------------------------------------
// Mini-timeline constants
// The compact preview covers 6 AM → midnight (1 080 min).
// At PX_PER_MIN = 0.30, that is 324 px — fits comfortably in the
// non-maximized widget without a scrollbar on most displays.
// -------------------------------------------------------------------
const PX = 0.30
const START = 6 * 60   // 06:00 in minutes-from-midnight
const END = 24 * 60    // 24:00 (midnight)
const TOTAL_H = (END - START) * PX  // 324 px

// Hour ticks shown on the axis (every 2 h)
const HOUR_TICKS = [6, 8, 10, 12, 14, 16, 18, 20, 22]

function toTop(min) {
  return (Math.max(START, Math.min(END, min)) - START) * PX
}

function slotHeight(slot) {
  return Math.max(14, (slot.endMin - slot.startMin) * PX)
}

/** Hex color → rgba string */
function rgba(hex, a) {
  const h = (hex || '#6366f1').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

/** Compact "12p" / "9a" label for the axis. */
function axisLabel(h) {
  if (h === 12) return '12p'
  return h > 12 ? `${h - 12}p` : `${h}a`
}

/**
 * Mini day-view calendar shown when the Timetable widget is in the grid
 * (non-maximised). Replaces the old flat-list view with a visual timeline
 * that always shows the time axis — even when no sessions exist — so the
 * user can see the shape of their day at a glance.
 */
export function TodayAgenda({ slots, onOpenSlot, onAdd }) {
  const today = todayDow()
  const nowMin = useNowMinutes()
  const scrollRef = useRef(null)

  const todays = slots
    .filter((s) => isSlotOnDay(s, today))
    .sort((a, b) => a.startMin - b.startMin)

  const nowTop = toTop(nowMin)
  const nowVisible = nowMin >= START && nowMin <= END

  // Auto-scroll so the "now" line is roughly 1/3 from the top on mount.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !nowVisible) return
    const desired = nowTop - el.clientHeight / 3
    el.scrollTop = Math.max(0, desired)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* ── Header row ── */}
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-xs font-medium text-muted">{DAY_FULL[today]}</span>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {/* ── Mini timeline ── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: TOTAL_H }}>

          {/* Time axis */}
          <div className="relative w-7 shrink-0">
            {HOUR_TICKS.map((h) => (
              <span
                key={h}
                className="absolute right-1 select-none text-[9px] leading-none text-muted/60"
                style={{ top: toTop(h * 60) - 4 }}
              >
                {axisLabel(h)}
              </span>
            ))}
          </div>

          {/* Grid column — hour lines + slot blocks + now indicator.
              Clicking empty space pre-fills that time in the creation modal. */}
          <div
            className="relative flex-1 cursor-crosshair border-l border-line/25"
            onClick={(e) => {
              // Only fire when clicking the background, not a slot block
              if (e.target !== e.currentTarget) return
              const rect = e.currentTarget.getBoundingClientRect()
              const raw = START + (e.clientY - rect.top) / PX
              const startMin = Math.max(START, Math.min(END - 30, snap(raw, 5)))
              onAdd(startMin, Math.min(startMin + 60, END))
            }}
          >

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
            {todays.map((slot) => {
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

            {/* Now indicator — dot + red line */}
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

            {/* Empty-state hint (only when no sessions AND now is visible) */}
            {todays.length === 0 && (
              <div
                className="pointer-events-none absolute left-2 right-2 flex items-center justify-center"
                style={{ top: nowVisible ? nowTop + 8 : TOTAL_H / 2 - 16 }}
              >
                <span className="rounded-full bg-surface-2/80 px-2.5 py-1 text-[10px] text-muted/60 backdrop-blur-sm">
                  No sessions — tap + Add
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
