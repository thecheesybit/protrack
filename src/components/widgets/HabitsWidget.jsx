import { useState, memo, useCallback } from 'react'
import { Plus, Check, Flame, Pencil, ListChecks, Sparkles, BellRing, Bell, Info } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useHabits } from '@/hooks/useWellness'
import { missedToday, triggerHabitCue } from '@/hooks/useHabitReminders'
import { WidgetFrame } from './WidgetFrame'
import { HabitEditorModal } from '@/components/wellness/HabitEditorModal'
import { getIcon } from '@/lib/icons'
import { ymd, computeStreak, lastNDays } from '@/lib/dates'
import { toggleHabitToday, addHabit } from '@/services/habitService'
import { SCIENTIFIC_HABIT_PRESETS } from '@/lib/constants'
import { playHabitChime } from '@/lib/sound'
import { cn } from '@/utils/cn'

const PresetLibrary = memo(function PresetLibrary({ missingPresets, onAddPreset }) {
  return (
    <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
      {missingPresets.map((p) => {
        const Icon = getIcon(p.icon)
        return (
          <button
            key={p.name}
            onClick={() => onAddPreset(p)}
            className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-surface-2/40 px-2.5 py-1 text-xs font-medium transition-all hover:border-accent/60 hover:bg-surface-2"
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-md"
              style={{ backgroundColor: `${p.color}22`, color: p.color }}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span>{p.name}</span>
            <span className="text-[10px] text-muted font-normal">({p.recommendedIntervalLabel})</span>
            <Plus className="h-3 w-3 text-muted ml-0.5" />
          </button>
        )
      })}
    </div>
  )
})

const HabitToggle = memo(function HabitToggle({ habit, uid, today }) {
  const target = Math.max(1, habit.timesPerDay || 1)
  const current = habit.dayLogs?.[today] ?? ((habit.doneDates || []).includes(today) ? 1 : 0)
  const isAllDone = current >= target

  return (
    <button
      onClick={() => {
        if (!isAllDone) playHabitChime()
        toggleHabitToday(uid, habit)
      }}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 relative',
        isAllDone
          ? 'border-transparent text-white shadow-sm'
          : current > 0
            ? 'border-accent text-accent bg-accent/10'
            : 'border-line text-transparent hover:border-accent',
      )}
      style={isAllDone ? { backgroundColor: habit.color } : undefined}
      title={target > 1 ? `${current}/${target} completed today (click to log)` : 'Toggle today'}
      aria-label="Toggle habit"
    >
      {isAllDone ? (
        <Check className="h-4 w-4" />
      ) : target > 1 && current > 0 ? (
        <span className="text-[10px] font-bold">{current}</span>
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
    </button>
  )
})

export function HabitsWidget({ widget, variant }) {
  const { user } = useAuth()
  const habits = useHabits()
  const isHero = variant === 'hero'
  const today = ymd()
  const week = lastNDays(7)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [activeRationaleId, setActiveRationaleId] = useState(null)

  const doneToday = habits.filter((h) => {
    const target = Math.max(1, h.timesPerDay || 1)
    const count = h.dayLogs?.[today] ?? ((h.doneDates || []).includes(today) ? 1 : 0)
    return count >= target
  }).length

  const existingNames = new Set(habits.map((h) => h.name.toLowerCase()))
  const missingPresets = SCIENTIFIC_HABIT_PRESETS.filter((p) => !existingNames.has(p.name.toLowerCase()))

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const addPreset = useCallback((p) => {
    if (!user) return
    addHabit(user.uid, {
      name: p.name,
      icon: p.icon,
      color: p.color,
      order: habits.length,
      interval: p.interval,
      timesPerDay: p.timesPerDay,
      timesPerWeek: p.timesPerWeek,
      scienceRationale: p.scienceRationale,
      scienceDomain: p.scienceDomain,
      recommendedInterval: p.interval,
      reminderToast: true,
      reminderSound: true,
    })
  }, [user, habits.length])


  return (
    <>
      <WidgetFrame
        widget={widget}
        variant={variant}
        subtitle={`${doneToday}/${habits.length} done today`}
        headerActions={
          isHero ? (
            <div className="flex items-center gap-1.5">
              {missingPresets.length > 0 && (
                <button
                  onClick={() => missingPresets.forEach(addPreset)}
                  title="Add starter habits"
                  className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted hover:text-ink"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Starter
                </button>
              )}
              <button onClick={openCreate} className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted hover:text-ink">
                <Plus className="h-3.5 w-3.5" /> Habit
              </button>
            </div>
          ) : null
        }
      >
        {habits.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line/60 px-4 py-6 text-center">
            <ListChecks className="h-6 w-6 text-muted" />
            <PresetLibrary missingPresets={missingPresets} onAddPreset={addPreset} />
            <button onClick={openCreate} className="text-xs font-medium text-accent hover:underline">
              or create your own
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
            {habits.map((h) => {
              const Icon = getIcon(h.icon)
              const streak = computeStreak(h.doneDates || [])
              const missed = missedToday(h)
              const target = Math.max(1, h.timesPerDay || 1)
              const current = h.dayLogs?.[today] ?? ((h.doneDates || []).includes(today) ? 1 : 0)
              const isShowingRationale = activeRationaleId === h.id

              return (
                <div
                  key={h.id}
                  className="group flex flex-col gap-1.5 rounded-2xl border border-line/50 bg-surface-2/30 p-2.5 transition-all hover:border-accent/40"
                >
                  <div className="flex items-center gap-2.5">
                    <HabitToggle habit={h} uid={user?.uid} today={today} />
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: `${h.color}22`, color: h.color }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold leading-tight text-ink truncate">
                          {h.name}
                        </span>
                        {target > 1 && (
                          <span className="rounded-md border border-line/60 bg-surface px-1.5 py-0.2 text-[9px] font-mono font-semibold text-muted">
                            {current}/{target}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted truncate flex items-center gap-1.5 mt-0.5">
                        {h.interval && h.interval !== 'none' && (
                          <span className="text-accent font-medium">
                            {h.interval.replace('every-', 'Every ')}
                          </span>
                        )}
                        {h.timesPerWeek && <span>• {h.timesPerWeek}d/wk</span>}
                        {target > 1 && <span>• {target}x/d</span>}
                      </div>
                    </div>

                    {/* Scientific info rationale trigger button */}
                    {h.scienceRationale && (
                      <button
                        onClick={() => setActiveRationaleId(isShowingRationale ? null : h.id)}
                        className={cn(
                          'rounded-lg p-1 text-xs transition-colors',
                          isShowingRationale
                            ? 'bg-accent/15 text-accent'
                            : 'text-muted hover:text-accent hover:bg-surface-2',
                        )}
                        title="View scientific reason"
                        aria-label="View scientific rationale"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Test Audio Chime & Interactive Toast Cue */}
                    {h.interval && h.interval !== 'none' && (
                      <button
                        onClick={() => triggerHabitCue(user.uid, h)}
                        className="rounded-lg p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-accent hover:bg-accent/10 transition-all"
                        title="Test automated toast & sound reminder"
                        aria-label="Test reminder cue"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {missed > 0 && (
                      <span
                        title={`${missed} reminder${missed > 1 ? 's' : ''} missed today`}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400"
                      >
                        <BellRing className="h-3 w-3" /> {missed}
                      </span>
                    )}

                    {isHero && (
                      <div className="hidden items-center gap-1 sm:flex">
                        {week.map((d) => (
                          <span
                            key={d.key}
                            title={d.short}
                            className={cn('h-2.5 w-2.5 rounded-full', (h.doneDates || []).includes(d.key) ? '' : 'bg-surface-2')}
                            style={(h.doneDates || []).includes(d.key) ? { backgroundColor: h.color } : undefined}
                          />
                        ))}
                      </div>
                    )}

                    <span className="flex items-center gap-1 text-xs text-muted font-mono">
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      {streak}
                    </span>

                    {isHero && (
                      <button
                        onClick={() => {
                          setEditing(h)
                          setEditorOpen(true)
                        }}
                        className="text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                        aria-label="Edit habit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Expandable Science Rationale Note */}
                  {isShowingRationale && h.scienceRationale && (
                    <div className="mt-1 rounded-xl border border-accent/30 bg-accent/5 p-2.5 text-[11px] leading-relaxed text-muted animate-fade-in">
                      <div className="font-semibold text-accent flex items-center gap-1 mb-0.5">
                        <Sparkles className="h-3 w-3" /> Scientific Evidence
                      </div>
                      <p>{h.scienceRationale}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </WidgetFrame>

      <HabitEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        habit={editing}
        order={habits.length}
      />
    </>
  )
}
