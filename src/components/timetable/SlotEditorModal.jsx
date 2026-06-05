import { useEffect, useMemo, useState } from 'react'
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
  minutesToLabel,
} from '@/lib/time'
import { addSlot, updateSlot, deleteSlot } from '@/services/timetableService'
import {
  isCalendarConnected,
  pushSlotToCalendar,
} from '@/services/calendarService'
import { cn } from '@/utils/cn'

export function SlotEditorModal({ open, onClose, modeId, slot }) {
  const { user } = useAuth()
  const [draft, setDraft] = useState(slot)
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(slot?.id)

  useEffect(() => {
    if (open) setDraft(slot)
  }, [open, slot])

  const timeOptions = useMemo(() => {
    const out = []
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 15) out.push(m)
    return out
  }, [])

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
      }
      if (isEdit) await updateSlot(user.uid, modeId, draft.id, payload)
      else await addSlot(user.uid, modeId, payload)
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
      <label className="mb-1.5 block text-xs font-medium text-muted">Label</label>
      <input
        autoFocus
        value={draft.label || ''}
        onChange={(e) => patch({ label: e.target.value })}
        placeholder="e.g. Polity revision"
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
          <select
            value={draft.startMin}
            onChange={(e) => patch({ startMin: Number(e.target.value) })}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            {timeOptions.map((m) => (
              <option key={m} value={m}>
                {minutesToLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">To</label>
          <select
            value={draft.endMin}
            onChange={(e) => patch({ endMin: Number(e.target.value) })}
            className="w-full rounded-xl border border-line bg-surface-2/60 px-2.5 py-2.5 text-sm outline-none focus:border-accent"
          >
            {timeOptions.map((m) => (
              <option key={m} value={m}>
                {minutesToLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="mb-2 mt-4 block text-xs font-medium text-muted">Color</label>
      <div className="flex flex-wrap gap-2">
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

      {isEdit && (
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
