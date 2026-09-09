import { useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { playSuccess, playPop } from '@/lib/sound'
import { recordHabitCompletion } from '@/services/habitService'
import { cn } from '@/utils/cn'

/**
 * Routine / habit cue body for the center prompt. "Mark Done" logs the
 * completion and advances the queue; "Snooze" defers to the shell's dismiss,
 * which re-fires the cue once in 5 minutes — one snooze per cue per day, after
 * which the button is disabled and the cue auto-marks missed at `expiresAt`.
 * Ported from the old HabitReminderToast (now removed).
 */
const fmtTime = (ts) =>
  typeof ts === 'number'
    ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null

export function RoutinePromptBody({ prompt, uid, onResolve, onDismiss }) {
  const habit = prompt.payload || {}
  const Icon = getIcon(habit.icon)
  const color = habit.color || '#10b981'
  const [busy, setBusy] = useState(false)
  const snoozeUsed = Boolean(habit.snoozeUsed)
  const missesAt = fmtTime(habit.expiresAt)

  const markDone = async () => {
    if (busy) return
    setBusy(true)
    playSuccess()
    try {
      await recordHabitCompletion(uid, habit)
    } catch (err) {
      console.error('[habit] log from prompt failed', err)
    }
    onResolve()
  }

  const snooze = () => {
    if (snoozeUsed) return
    playPop()
    onDismiss()
  }

  return (
    <div className="flex flex-col gap-3 pr-6">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {habit.isSnoozed ? 'Snoozed reminder' : 'Habit cue'} • {habit.interval?.replace('every-', 'Every ') || 'Routine'}
          </span>
          <h4 className="text-base font-bold text-ink">Time to {habit.name}</h4>
          {habit.scienceRationale && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
              {habit.scienceRationale}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line/40 pt-3">
        <button
          onClick={markDone}
          disabled={busy}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50',
          )}
          style={{ backgroundColor: color }}
        >
          <Check className="h-4 w-4" />
          Mark done
        </button>
        <button
          onClick={snooze}
          disabled={snoozeUsed}
          className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          title={snoozeUsed ? 'Already snoozed once' : 'Remind me again in 5 minutes'}
        >
          <Clock className="h-3.5 w-3.5" />
          {snoozeUsed ? 'Snoozed once' : 'Snooze 5 min'}
        </button>
      </div>

      {missesAt && (
        <p className="text-center text-[10px] text-muted/70">
          {snoozeUsed ? 'No more snoozes · ' : ''}Auto-marks missed at {missesAt}
        </p>
      )}
    </div>
  )
}
