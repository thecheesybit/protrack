import { useEffect, useState } from 'react'
import { Trash2, Sparkles, Bell, Volume2, Info, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE, SCIENTIFIC_HABIT_PRESETS } from '@/lib/constants'
import { getIcon } from '@/lib/icons'
import { addHabit, updateHabit, deleteHabit } from '@/services/habitService'
import { clearPendingHabitSnooze } from '@/hooks/useHabitReminders'
import { cn } from '@/utils/cn'

const HABIT_ICONS = [
  'Heart',
  'Dumbbell',
  'Droplets',
  'BookOpen',
  'Brain',
  'Trees',
  'Music',
  'Trophy',
  'Target',
  'Sparkles',
]

const INTERVAL_OPTIONS = [
  { value: 'none', label: 'No periodic interval (Manual check-in)' },
  { value: 'every-20m', label: 'Every 20 minutes (20-20-20 Eye Rule)' },
  { value: 'every-30m', label: 'Every 30 minutes (Screen Break)' },
  { value: 'every-45m', label: 'Every 45 minutes (Pomodoro interval)' },
  { value: 'every-1h', label: 'Every 1 hour (Posture & Mobility)' },
  { value: 'every-90m', label: 'Every 90 minutes (Ultradian Rhythm)' },
  { value: 'every-2h', label: 'Every 2 hours (Recommended for Hydration)' },
  { value: 'every-3h', label: 'Every 3 hours (Mindfulness / Breath)' },
  { value: 'every-4h', label: 'Every 4 hours (Study / Deep Work)' },
  { value: 'every-6h', label: 'Every 6 hours' },
  { value: 'morning', label: 'Morning (9:00 AM)' },
  { value: 'afternoon', label: 'Afternoon (2:00 PM)' },
  { value: 'evening', label: 'Evening (7:00 PM)' },
]

export function HabitEditorModal({ open, onClose, habit, order }) {
  const { user } = useAuth()
  const isEdit = Boolean(habit?.id)
  const [draft, setDraft] = useState({
    name: '',
    icon: 'Heart',
    color: '#10b981',
    timesPerWeek: 7,
    timesPerDay: 1,
    interval: 'none',
    scienceRationale: '',
    scienceDomain: '',
    reminderToast: true,
    reminderSound: true,
  })
  const [saving, setSaving] = useState(false)
  const [, setShowRationale] = useState(true)

  useEffect(() => {
    if (!open) return
    setDraft(
      habit
        ? {
            name: habit.name || '',
            icon: habit.icon || 'Heart',
            color: habit.color || '#10b981',
            timesPerWeek: habit.timesPerWeek ?? 7,
            timesPerDay: habit.timesPerDay ?? 1,
            interval: habit.interval ?? 'none',
            scienceRationale: habit.scienceRationale || '',
            scienceDomain: habit.scienceDomain || '',
            reminderToast: habit.reminderToast !== false,
            reminderSound: habit.reminderSound !== false,
          }
        : {
            name: '',
            icon: 'Heart',
            color: MODE_PALETTE[(order || 0) % MODE_PALETTE.length],
            timesPerWeek: 7,
            timesPerDay: 1,
            interval: 'none',
            scienceRationale: '',
            scienceDomain: '',
            reminderToast: true,
            reminderSound: true,
          },
    )
  }, [open, habit, order])

  // Look for matching scientific preset
  const matchedPreset = SCIENTIFIC_HABIT_PRESETS.find(
    (p) => p.name.toLowerCase() === draft.name.trim().toLowerCase(),
  )

  const applyPreset = (p) => {
    setDraft((d) => ({
      ...d,
      name: p.name,
      icon: p.icon,
      color: p.color,
      interval: p.interval,
      timesPerDay: p.timesPerDay,
      timesPerWeek: p.timesPerWeek,
      scienceRationale: p.scienceRationale,
      scienceDomain: p.scienceDomain,
    }))
    setShowRationale(true)
  }

  const save = async () => {
    const name = draft.name.trim()
    if (!name) return toast.error('Name your habit')
    setSaving(true)
    try {
      const payload = {
        name,
        icon: draft.icon,
        color: draft.color,
        timesPerWeek: Number(draft.timesPerWeek),
        timesPerDay: Number(draft.timesPerDay),
        interval: draft.interval,
        scienceRationale: draft.scienceRationale || matchedPreset?.scienceRationale || '',
        scienceDomain: draft.scienceDomain || matchedPreset?.scienceDomain || '',
        reminderToast: draft.reminderToast,
        reminderSound: draft.reminderSound,
      }
      if (isEdit) {
        await updateHabit(user.uid, habit.id, payload)
        toast.success('Habit updated')
      } else {
        await addHabit(user.uid, { ...payload, order: order || 0 })
        toast.success('Habit created with automated reminders')
      }
      onClose()
    } catch (err) {
      console.error('[habit] save failed', err)
      toast.error('Could not save habit')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    try {
      // Cancel any pending snooze re-fire first — otherwise a habit snoozed
      // right before deletion still rings ~5 min later for a habit that no
      // longer exists, and the resulting "Mark done" tap fails silently
      // against a missing Firestore doc.
      clearPendingHabitSnooze(habit.id)
      await deleteHabit(user.uid, habit.id)
      onClose()
    } catch {
      toast.error('Could not delete habit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Habit' : 'Create Evidence-Based Habit'}
      footer={
        <>
          {isEdit && (
            <Button size="sm" variant="ghost" className="mr-auto text-red-400" onClick={remove} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {isEdit ? 'Save Changes' : 'Create Habit'}
          </Button>
        </>
      }
    >
      {/* Evidence-based quick starter library */}
      {!isEdit && (
        <div className="mb-3">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-accent" /> Scientifically Recommended Routines
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {SCIENTIFIC_HABIT_PRESETS.map((p) => {
              const Icon = getIcon(p.icon)
              const isCurrent = draft.name.toLowerCase() === p.name.toLowerCase()
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-all',
                    isCurrent
                      ? 'border-accent bg-accent/15 text-accent font-semibold'
                      : 'border-line/70 bg-surface-2/40 text-muted hover:text-ink hover:border-line',
                  )}
                >
                  <Icon className="h-3 w-3" style={{ color: p.color }} />
                  <span>{p.name}</span>
                  <span className="text-[9px] opacity-70">({p.recommendedIntervalLabel})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <label className="mb-1.5 block text-xs font-medium text-muted">Habit Name</label>
      <input
        autoFocus
        value={draft.name}
        onChange={(e) => {
          const val = e.target.value
          const match = SCIENTIFIC_HABIT_PRESETS.find((p) => p.name.toLowerCase() === val.trim().toLowerCase())
          setDraft((d) => ({
            ...d,
            name: val,
            scienceRationale: match ? match.scienceRationale : d.scienceRationale,
            scienceDomain: match ? match.scienceDomain : d.scienceDomain,
            interval: match && d.interval === 'none' ? match.interval : d.interval,
            timesPerDay: match && d.timesPerDay === 1 ? match.timesPerDay : d.timesPerDay,
          }))
        }}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="e.g. Hydration, Core Reading, Posture Break"
        className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />

      {/* Science Rationale Card (When preset matched or custom explanation exists) */}
      {(draft.scienceRationale || matchedPreset) && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-accent flex items-center gap-1">
              <Info className="h-3.5 w-3.5" />
              Scientific Rationale · {draft.scienceDomain || matchedPreset?.scienceDomain || 'Evidence Base'}
            </span>
            <span className="text-[10px] text-muted font-mono">
              Rec: {matchedPreset?.recommendedIntervalLabel || 'Periodic interval'}
            </span>
          </div>
          <p className="text-muted leading-relaxed text-[11px]">
            {draft.scienceRationale || matchedPreset?.scienceRationale}
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-[10px] font-semibold text-muted uppercase tracking-wider">Per Week</label>
          <select
            value={draft.timesPerWeek}
            onChange={(e) => setDraft((d) => ({ ...d, timesPerWeek: Number(e.target.value) }))}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs outline-none focus:border-accent"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((num) => (
              <option key={num} value={num}>
                {num} day{num > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-semibold text-muted uppercase tracking-wider">Per Day Target</label>
          <select
            value={draft.timesPerDay}
            onChange={(e) => setDraft((d) => ({ ...d, timesPerDay: Number(e.target.value) }))}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs outline-none focus:border-accent"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((num) => (
              <option key={num} value={num}>
                {num} time{num > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-semibold text-muted uppercase tracking-wider">Interval Cue</label>
          <select
            value={draft.interval}
            onChange={(e) => setDraft((d) => ({ ...d, interval: e.target.value }))}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs outline-none focus:border-accent"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reminder notification & sound controls */}
      {draft.interval !== 'none' && (
        <div className="mt-3 rounded-xl border border-line/50 bg-surface-2/30 p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Bell className="h-4 w-4" />
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-ink text-xs">Automated Toast & Audio Cue</span>
              <span className="text-[10px] text-muted">
                Toast pops up with audio chime & "Done" button at every interval
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, reminderSound: !d.reminderSound }))}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors border',
                draft.reminderSound
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-line text-muted',
              )}
              title="Auditory chime"
            >
              <Volume2 className="h-3 w-3" />
              <span>Chime</span>
            </button>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, reminderToast: !d.reminderToast }))}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors border',
                draft.reminderToast
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-line text-muted',
              )}
              title="Interactive Toast"
            >
              <Check className="h-3 w-3" />
              <span>Toast</span>
            </button>
          </div>
        </div>
      )}

      <label className="mb-2 mt-4 block text-xs font-medium text-muted">Color</label>
      <div className="flex flex-wrap gap-2">
        {MODE_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setDraft((d) => ({ ...d, color: c }))}
            className={cn('h-7 w-7 rounded-full transition-transform', draft.color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface' : 'hover:scale-105')}
            style={{ backgroundColor: c, '--tw-ring-color': c }}
            aria-label={c}
          />
        ))}
      </div>

      <label className="mb-2 mt-4 block text-xs font-medium text-muted">Icon</label>
      <div className="grid grid-cols-10 gap-1.5">
        {HABIT_ICONS.map((name) => {
          const Icon = getIcon(name)
          const active = draft.icon === name
          return (
            <button
              key={name}
              onClick={() => setDraft((d) => ({ ...d, icon: name }))}
              className={cn('flex aspect-square items-center justify-center rounded-lg border transition-colors', active ? 'border-transparent text-white' : 'border-line text-muted hover:text-ink')}
              style={active ? { backgroundColor: draft.color } : undefined}
              aria-label={name}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
