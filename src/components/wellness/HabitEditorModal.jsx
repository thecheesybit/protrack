import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE } from '@/lib/constants'
import { getIcon } from '@/lib/icons'
import { addHabit, updateHabit, deleteHabit } from '@/services/habitService'
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
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(
      habit
        ? {
            name: habit.name,
            icon: habit.icon,
            color: habit.color,
            timesPerWeek: habit.timesPerWeek ?? 7,
            timesPerDay: habit.timesPerDay ?? 1,
            interval: habit.interval ?? 'none',
          }
        : {
            name: '',
            icon: 'Heart',
            color: MODE_PALETTE[(order || 0) % MODE_PALETTE.length],
            timesPerWeek: 7,
            timesPerDay: 1,
            interval: 'none',
          },
    )
  }, [open, habit, order])

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
      }
      if (isEdit) {
        await updateHabit(user.uid, habit.id, payload)
      } else {
        await addHabit(user.uid, { ...payload, order: order || 0 })
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
      title={isEdit ? 'Edit habit' : 'New habit'}
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
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <label className="mb-1.5 block text-xs font-medium text-muted">Name</label>
      <input
        autoFocus
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="e.g. Read 20 pages"
        className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />

      <div className="mt-4 grid grid-cols-3 gap-3">
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
          <label className="mb-1.5 block text-[10px] font-semibold text-muted uppercase tracking-wider">Per Day</label>
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
          <label className="mb-1.5 block text-[10px] font-semibold text-muted uppercase tracking-wider">Interval</label>
          <select
            value={draft.interval}
            onChange={(e) => setDraft((d) => ({ ...d, interval: e.target.value }))}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs outline-none focus:border-accent"
          >
            <option value="none">No interval</option>
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
            <option value="2h">2 hours</option>
            <option value="3h">3 hours</option>
            <option value="4h">4 hours</option>
            <option value="6h">6 hours</option>
            <option value="12h">12 hours</option>
          </select>
        </div>
      </div>

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
