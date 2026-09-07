import { useState } from 'react'
import toast from 'react-hot-toast'
import { Check, Clock, X, Sparkles } from 'lucide-react'
import { getIcon } from '@/lib/icons'
import { playSuccess, playPop } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

/**
 * Interactive Habit Reminder Toast.
 * Surfaced directly on scheduled habit intervals with an auditory chime.
 * Allows the user to click "Done" to automatically log completion and response,
 * without having to navigate into the habits panel.
 */
export function HabitReminderToast({
  toastId,
  habit,
  targetCount = 1,
  currentCount = 0,
  onDone,
  onSnooze,
}) {
  const [completed, setCompleted] = useState(false)
  const Icon = getIcon(habit.icon)
  const color = habit.color || '#10b981'

  const handleDone = async (e) => {
    e?.stopPropagation()
    setCompleted(true)
    playSuccess()
    try {
      await onDone?.(habit)
    } catch (err) {
      console.error('Failed to log habit from toast', err)
    }
    setTimeout(() => {
      toast.dismiss(toastId)
    }, 1500)
  }

  const handleSnooze = (e) => {
    e?.stopPropagation()
    playPop()
    onSnooze?.(habit)
    toast.dismiss(toastId)
    toast('Reminder snoozed for 10 minutes', { icon: '⏰', duration: 2500 })
  }

  const handleClose = (e) => {
    e?.stopPropagation()
    toast.dismiss(toastId)
  }

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border bg-surface/95 p-4 shadow-glass-lg backdrop-blur-2xl transition-all duration-300',
        completed
          ? 'border-emerald-500/60 bg-emerald-500/10'
          : 'border-line/70 hover:border-accent/50',
      )}
      style={{
        boxShadow: `0 10px 30px -5px ${color}25, 0 0 0 1px ${color}30`,
      }}
    >
      {/* Accent glow bar */}
      <div
        className="absolute top-0 inset-x-0 h-1"
        style={{ backgroundColor: completed ? '#10b981' : color }}
      />

      <div className="flex items-start gap-3">
        {/* Habit Icon */}
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300',
            completed ? 'bg-emerald-500 text-white scale-110' : 'text-white shadow-sm',
          )}
          style={{ backgroundColor: completed ? '#10b981' : color }}
        >
          {completed ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </span>

        {/* Text Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Habit Cue • {habit.interval?.replace('every-', 'Every ') || 'Routine'}
            </span>
            <button
              onClick={handleClose}
              className="text-muted hover:text-ink rounded p-0.5"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <h4 className="text-sm font-bold text-ink truncate">
            {completed ? `Completed: ${habit.name}!` : `Time to ${habit.name}`}
          </h4>

          {completed ? (
            <p className="text-xs text-emerald-400 font-medium animate-fade-in flex items-center gap-1 mt-0.5">
              <Sparkles className="h-3.5 w-3.5" /> Logged! {currentCount + 1}/{targetCount} completed today
            </p>
          ) : habit.scienceRationale ? (
            <p className="text-[11px] text-muted line-clamp-2 leading-relaxed mt-0.5">
              {habit.scienceRationale}
            </p>
          ) : (
            <p className="text-xs text-muted">
              Take a moment to check in with this habit.
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      {!completed && (
        <div className="mt-3 flex items-center gap-2 pt-2 border-t border-line/40">
          <button
            onClick={handleDone}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold text-white shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: color }}
          >
            <Check className="h-4 w-4" />
            <span>Mark Done</span>
          </button>

          <button
            onClick={handleSnooze}
            className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-2 transition-colors"
            title="Remind me again in 10 minutes"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Snooze</span>
          </button>
        </div>
      )}
    </div>
  )
}
