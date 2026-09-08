import { useEffect, useState } from 'react'
import { Trash2, CalendarPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE } from '@/lib/constants'
import {
  DAYS,
  DAY_START_MIN,
  DAY_END_MIN,
  clampMin,
} from '@/lib/time'
import { addSlot, updateSlot, deleteSlot } from '@/services/timetableService'
import {
  isCalendarConnected,
  pushSlotToCalendar,
} from '@/services/calendarService'
import { GCAL_ENABLED } from '@/lib/flags'
import { cn } from '@/utils/cn'

/** Convert minutes-from-midnight → "HH:MM" for <input type="time"> */
function toTimeValue(min) {
  if (min == null) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Parse "HH:MM" from <input type="time"> → minutes-from-midnight */
function timeValueToMin(val) {
  if (!val) return DAY_START_MIN
  const [h, m] = val.split(':').map(Number)
  return clampMin(h * 60 + (m || 0))
}

export function SlotEditorModal({ open, onClose, modeId: propModeId, slot, allModes, subjects = [] }) {
  const { user } = useAuth()
  const modeId = slot?._modeId || propModeId
  const [targetModeId, setTargetModeId] = useState(modeId)
  const [draft, setDraft] = useState(() => ({
    recurrenceType: 'weekly',
    recurrenceDays: [],
    recurrenceInterval: 1,
    recurrenceStartDate: new Date().toISOString().split('T')[0],
    tag: '',
    tagStyle: 'standard',
    ...slot,
  }))
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(slot?.id)

  useEffect(() => {
    if (open) {
      setTargetModeId(slot?._modeId || propModeId)
      setDraft({
        recurrenceType: 'weekly',
        recurrenceDays: [],
        recurrenceInterval: 1,
        recurrenceStartDate: new Date().toISOString().split('T')[0],
        tag: '',
        tagStyle: 'standard',
        ...slot,
      })
    }
  }, [open, slot, propModeId])

  if (!draft) return null

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))

  const save = async () => {
    const label = (draft.label || '').trim() || 'Study session'
    if (draft.endMin <= draft.startMin) return toast.error('End must be after start')
    setSaving(true)
    try {
      const payload = {
        label,
        dayOfWeek: draft.dayOfWeek,
        startMin: draft.startMin,
        endMin: draft.endMin,
        color: draft.color,
        subjectId: draft.subjectId || null,
        googleEventId: draft.googleEventId || null,
        recurrenceType: draft.recurrenceType || 'weekly',
        recurrenceDays: draft.recurrenceDays || [],
        recurrenceInterval: draft.recurrenceInterval || 1,
        recurrenceStartDate: draft.recurrenceStartDate || new Date().toISOString().split('T')[0],
        tag: draft.tag || '',
        tagStyle: draft.tagStyle || 'standard',
        // Preserve term bounds / room set from the subject editor.
        recurrenceEndDate: draft.recurrenceEndDate || null,
        room: draft.room || '',
      }
      const saveToMode = isEdit ? modeId : (targetModeId || modeId)
      if (isEdit) await updateSlot(user.uid, saveToMode, draft.id, payload)
      else await addSlot(user.uid, saveToMode, payload)
      onClose()
    } catch (err) {
      console.error('[timetable] save failed', err)
      toast.error('Could not save session')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true)
    try {
      await deleteSlot(user.uid, modeId, draft.id)
      onClose()
    } catch (err) {
      console.error('[timetable] delete failed', err)
      toast.error('Could not delete')
    } finally {
      setSaving(false)
    }
  }

  const pushToCalendar = async () => {
    if (!isCalendarConnected()) return toast.error('Connect Google Calendar first')
    try {
      const eventId = await pushSlotToCalendar(draft)
      if (isEdit) await updateSlot(user.uid, modeId, draft.id, { googleEventId: eventId })
      patch({ googleEventId: eventId })
      toast.success('Added to Google Calendar')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit session' : 'New session'}
      footer={
        <>
          {isEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="mr-auto text-red-400"
              onClick={remove}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      {/* Mode selector — shown when creating in All Scopes view */}
      {!isEdit && allModes?.length > 1 && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted">Mode</label>
          <select
            value={targetModeId || ''}
            onChange={(e) => setTargetModeId(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            {allModes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {subjects.length > 0 && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted">Subject / class</label>
          <select
            value={draft.subjectId || ''}
            onChange={(e) => {
              const sid = e.target.value || null
              const subj = subjects.find((s) => s.id === sid)
              patch({
                subjectId: sid,
                ...(subj?.color ? { color: subj.color } : {}),
                ...(subj && !((draft.label || '').trim()) ? { label: subj.name } : {}),
              })
            }}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="">— None (general session) —</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="mb-1.5 block text-xs font-medium text-muted">Label</label>
      <input
        autoFocus
        value={draft.label || ''}
        onChange={(e) => patch({ label: e.target.value })}
        placeholder="e.g. Lecture, Lab, Polity revision"
        className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Day</label>
          <select
            value={draft.dayOfWeek}
            onChange={(e) => patch({ dayOfWeek: Number(e.target.value) })}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">From</label>
          <input
            type="time"
            value={toTimeValue(draft.startMin)}
            onChange={(e) => patch({ startMin: timeValueToMin(e.target.value) })}
            min={toTimeValue(DAY_START_MIN)}
            max={toTimeValue(DAY_END_MIN)}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">To</label>
          <input
            type="time"
            value={toTimeValue(draft.endMin)}
            onChange={(e) => patch({ endMin: timeValueToMin(e.target.value) })}
            min={toTimeValue(DAY_START_MIN)}
            max={toTimeValue(DAY_END_MIN)}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <label className="mb-2 mt-4 block text-xs font-medium text-muted">Color</label>
      <div className="flex flex-wrap gap-2 mb-4">
        {MODE_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => patch({ color: c })}
            className={cn(
              'h-7 w-7 rounded-full transition-transform',
              draft.color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface' : 'hover:scale-105',
            )}
            style={{ backgroundColor: c, '--tw-ring-color': c }}
            aria-label={c}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Tag / Type</label>
          <input
            value={draft.tag || ''}
            onChange={(e) => patch({ tag: e.target.value })}
            placeholder="e.g. Theory, Lab"
            className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Tag Style</label>
          <select
            value={draft.tagStyle || 'standard'}
            onChange={(e) => patch({ tagStyle: e.target.value })}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            <option value="standard">Solid / Standard</option>
            <option value="striped">Striped (Lab style)</option>
            <option value="dashed">Dashed Border (Revision style)</option>
            <option value="dotted">Dotted Border</option>
          </select>
        </div>
      </div>

      <div className="mt-4 border-t border-line/50 pt-4">
        <label className="mb-1.5 block text-xs font-medium text-muted">Recurrence</label>
        <select
          value={draft.recurrenceType || 'weekly'}
          onChange={(e) => patch({ recurrenceType: e.target.value })}
          className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="weekly">Weekly (selected day)</option>
          <option value="daily">Daily (Mon - Sun)</option>
          <option value="custom_days">Specific days of week</option>
          <option value="interval">Every X days</option>
        </select>
      </div>

      {draft.recurrenceType === 'custom_days' && (
        <div className="mt-3">
          <label className="mb-1.5 block text-[11px] font-medium text-muted">Select days</label>
          <div className="flex gap-1.5">
            {DAYS.map((dayLabel, index) => {
              const active = draft.recurrenceDays?.includes(index)
              return (
                <button
                  key={dayLabel}
                  type="button"
                  onClick={() => {
                    const days = draft.recurrenceDays || []
                    const nextDays = days.includes(index)
                      ? days.filter((d) => d !== index)
                      : [...days, index]
                    patch({ recurrenceDays: nextDays })
                  }}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs transition-colors",
                    active ? "border-accent bg-accent/25 text-accent font-semibold" : "border-line text-muted hover:text-ink"
                  )}
                >
                  {dayLabel[0]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {draft.recurrenceType === 'interval' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted">Repeat every (days)</label>
            <input
              type="number"
              min="1"
              value={draft.recurrenceInterval || 1}
              onChange={(e) => patch({ recurrenceInterval: Math.max(1, Number(e.target.value)) })}
              className="w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted">Starting date</label>
            <input
              type="date"
              value={draft.recurrenceStartDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => patch({ recurrenceStartDate: e.target.value })}
              className="w-full rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {isEdit && GCAL_ENABLED && (
        <button
          onClick={pushToCalendar}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/50 py-2.5 text-sm text-muted transition-colors hover:text-ink"
        >
          <CalendarPlus className="h-4 w-4" />
          {draft.googleEventId ? 'Update in Google Calendar' : 'Add to Google Calendar'}
        </button>
      )}
    </Modal>
  )
}
