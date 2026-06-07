import { CalendarDays } from 'lucide-react'
import { DAY_FULL, todayDow, minutesToLabel, durationLabel, isSlotOnDay } from '@/lib/time'
import { useNowMinutes } from '@/hooks/useNowMinutes'

function SessionRow({ slot, onOpenSlot, active }) {
  return (
    <button
      onClick={() => onOpenSlot(slot)}
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors hover:border-accent/40 ${
        active
          ? 'border-accent/50 bg-accent/8 shadow-sm'
          : 'border-line/50 bg-surface-2/40'
      }`}
    >
      <span className="h-7 w-1 rounded-full" style={{ background: slot.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {slot.label || 'Session'}
          {slot.tag && (
            <span className="ml-1.5 inline-block rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-normal uppercase tracking-wider text-accent">
              {slot.tag}
            </span>
          )}
        </span>
        <span className="text-[11px] text-muted">
          {minutesToLabel(slot.startMin)} · {durationLabel(slot.startMin, slot.endMin)}
        </span>
      </span>
    </button>
  )
}

/** Compact "today" view shown when the Timetable widget is in the grid. */
export function TodayAgenda({ slots, onOpenSlot, onAdd }) {
  const today = todayDow()
  const nowMin = useNowMinutes()
  const todays = slots
    .filter((s) => isSlotOnDay(s, today))
    .sort((a, b) => a.startMin - b.startMin)

  const past = todays.filter((s) => s.endMin <= nowMin)
  const current = todays.filter((s) => s.startMin <= nowMin && s.endMin > nowMin)
  const future = todays.filter((s) => s.startMin > nowMin)
  const showNowDivider = (past.length > 0 || current.length > 0) && future.length > 0

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted">{DAY_FULL[today]}</span>
        <button onClick={onAdd} className="text-xs font-medium text-accent hover:underline">
          + Add
        </button>
      </div>

      {todays.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line/60 py-6 text-center">
          <CalendarDays className="h-6 w-6 text-muted" />
          <span className="text-xs text-muted">
            No sessions today.
            <br />
            Maximize to plan your week.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto">
          {past.map((s) => <SessionRow key={s.id} slot={s} onOpenSlot={onOpenSlot} />)}
          {current.map((s) => <SessionRow key={s.id} slot={s} onOpenSlot={onOpenSlot} active />)}
          {showNowDivider && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="h-px flex-1 bg-rose-500/40" />
              <span className="flex items-center gap-1 text-[10px] text-rose-400">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                {minutesToLabel(Math.round(nowMin))}
              </span>
              <span className="h-px flex-1 bg-rose-500/40" />
            </div>
          )}
          {future.map((s) => <SessionRow key={s.id} slot={s} onOpenSlot={onOpenSlot} />)}
        </div>
      )}
    </div>
  )
}
