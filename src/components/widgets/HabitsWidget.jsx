import { useState } from 'react'
import { Plus, Check, Flame, Pencil, ListChecks, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useHabits } from '@/hooks/useWellness'
import { WidgetFrame } from './WidgetFrame'
import { HabitEditorModal } from '@/components/wellness/HabitEditorModal'
import { getIcon } from '@/lib/icons'
import { ymd, computeStreak, lastNDays } from '@/lib/dates'
import { toggleHabitToday, addHabit } from '@/services/habitService'
import { HABIT_PRESETS } from '@/lib/constants'
import { cn } from '@/utils/cn'

export function HabitsWidget({ widget, variant }) {
  const { user } = useAuth()
  const habits = useHabits()
  const isHero = variant === 'hero'
  const today = ymd()
  const week = lastNDays(7)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const doneToday = habits.filter((h) => (h.doneDates || []).includes(today)).length

  const existingNames = new Set(habits.map((h) => h.name))
  const missingPresets = HABIT_PRESETS.filter((p) => !existingNames.has(p.name))

  const openCreate = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const addPreset = (p) => {
    if (existingNames.has(p.name)) return
    addHabit(user.uid, { name: p.name, icon: p.icon, color: p.color, order: habits.length })
  }

  const PresetLibrary = () => (
    <div className="flex flex-wrap gap-2">
      {missingPresets.map((p) => {
        const Icon = getIcon(p.icon)
        return (
          <button
            key={p.name}
            onClick={() => addPreset(p)}
            className="flex items-center gap-1.5 rounded-full border border-line/70 px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent/50"
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md"
              style={{ backgroundColor: `${p.color}22`, color: p.color }}
            >
              <Icon className="h-3 w-3" />
            </span>
            {p.name}
            <Plus className="h-3 w-3 text-muted" />
          </button>
        )
      })}
    </div>
  )

  const Toggle = ({ habit }) => {
    const done = (habit.doneDates || []).includes(today)
    return (
      <button
        onClick={() => toggleHabitToday(user.uid, habit)}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          done ? 'border-transparent text-white' : 'border-line text-transparent hover:border-accent',
        )}
        style={done ? { backgroundColor: habit.color } : undefined}
        aria-label="Toggle today"
      >
        <Check className="h-4 w-4" />
      </button>
    )
  }

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
            <span className="text-xs text-muted">Start with an evidence-based habit:</span>
            <PresetLibrary />
            <button onClick={openCreate} className="text-xs font-medium text-accent hover:underline">
              or create your own
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
            {habits.map((h) => {
              const Icon = getIcon(h.icon)
              const streak = computeStreak(h.doneDates || [])
              return (
                <div key={h.id} className="group flex items-center gap-2.5 rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2">
                  <Toggle habit={h} />
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${h.color}22`, color: h.color }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <div className="text-sm font-medium leading-none mb-1">{h.name}</div>
                    {(h.timesPerWeek || h.timesPerDay || (h.interval && h.interval !== 'none')) && (
                      <div className="text-[10px] text-muted truncate leading-none">
                        {h.timesPerWeek && `${h.timesPerWeek}d/wk`}
                        {h.timesPerDay && ` • ${h.timesPerDay}x/d`}
                        {h.interval && h.interval !== 'none' && ` • every ${h.interval}`}
                      </div>
                    )}
                  </div>

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

                  <span className="flex items-center gap-1 text-xs text-muted">
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
