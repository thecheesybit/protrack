import { CalendarDays } from 'lucide-react'
import { DAY_FULL, todayDow, minutesToLabel, durationLabel } from '@/lib/time'

/** Compact "today" view shown when the Timetable widget is in the grid. */
export function TodayAgenda({ slots, onOpenSlot, onAdd }) {
  const today = todayDow()
  const todays = slots.filter((s) => s.dayOfWeek === today)

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
          {todays.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpenSlot(s)}
              className="flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/40 px-3 py-2 text-left transition-colors hover:border-accent/40"
            >
              <span className="h-7 w-1 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {s.label || 'Session'}
                </span>
                <span className="text-[11px] text-muted">
                  {minutesToLabel(s.startMin)} · {durationLabel(s.startMin, s.endMin)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
