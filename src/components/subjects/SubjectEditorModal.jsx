import { useEffect, useMemo, useState } from 'react'
import { Trash2, Plus, X, CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE } from '@/lib/constants'
import { addSubject, updateSubject, deleteSubject } from '@/services/subjectService'
import { addSlot, updateSlot, deleteSlot } from '@/services/timetableService'
import { useTimetable } from '@/hooks/useTimetable'
import { DAYS, DAY_START_MIN } from '@/lib/time'
import { cn } from '@/utils/cn'

const toTime = (min) => {
  const h = Math.floor((min ?? DAY_START_MIN) / 60)
  const m = (min ?? DAY_START_MIN) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
const fromTime = (v) => {
  const [h, m] = (v || '09:00').split(':').map(Number)
  return h * 60 + (m || 0)
}
const CLASS_TYPES = {
  lecture: { label: 'Lecture', tag: 'Lecture', tagStyle: 'standard' },
  lab: { label: 'Lab', tag: 'Lab', tagStyle: 'striped' },
  tutorial: { label: 'Tutorial', tag: 'Tutorial', tagStyle: 'dashed' },
  seminar: { label: 'Seminar', tag: 'Seminar', tagStyle: 'dotted' },
  other: { label: '', tag: '', tagStyle: 'standard' },
}
// Repeat presets → the slot recurrence shape the grid already understands.
const REPEATS = {
  weekly: { recurrenceType: 'weekly' },
  fortnightly: { recurrenceType: 'interval', recurrenceInterval: 14 },
  monthly: { recurrenceType: 'interval', recurrenceInterval: 28 },
}
const blankClass = () => ({
  key: Math.random().toString(36).slice(2),
  dayOfWeek: 0,
  startMin: 9 * 60,
  endMin: 10 * 60,
  type: 'lecture',
  repeat: 'weekly',
  room: '',
  label: '',
})

export function SubjectEditorModal({ open, onClose, modeId: propModeId, subject, order, onDeleted }) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const isEdit = Boolean(subject?.id)
  const isGlobalScope = (propModeId === 'all' || !propModeId) && !isEdit
  const initialModeId = subject?._modeId || (propModeId && propModeId !== 'all' ? propModeId : modes[0]?.id)
  const [selectedModeId, setSelectedModeId] = useState(initialModeId)
  const [draft, setDraft] = useState({ name: '', color: MODE_PALETTE[0], targetHours: 0 })
  const [classTimes, setClassTimes] = useState([])
  const [saving, setSaving] = useState(false)

  // Existing class-time slots for this subject (edit mode).
  const editModeId = subject?._modeId || (propModeId && propModeId !== 'all' ? propModeId : null)
  const { slots } = useTimetable(isEdit ? editModeId : null)
  const existingSlots = useMemo(
    () => (isEdit ? (slots || []).filter((s) => s.subjectId === subject?.id) : []),
    [isEdit, slots, subject?.id],
  )

  useEffect(() => {
    if (!open) return
    const mode = subject?._modeId || (propModeId && propModeId !== 'all' ? propModeId : modes[0]?.id)
    setSelectedModeId(mode)
    setDraft(
      subject
        ? {
            name: subject.name,
            color: subject.color,
            targetHours: subject.targetHours || 0,
          }
        : { name: '', color: MODE_PALETTE[(order || 0) % MODE_PALETTE.length], targetHours: 0 },
    )
  }, [open, subject, order, propModeId, modes])

  // Hydrate the class-times editor from existing slots when the modal opens.
  useEffect(() => {
    if (!open) return
    setClassTimes(
      existingSlots.map((s) => ({
        key: s.id,
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startMin: s.startMin,
        endMin: s.endMin,
        type:
          Object.keys(CLASS_TYPES).find((k) => CLASS_TYPES[k].tag && CLASS_TYPES[k].tag === s.tag) || 'other',
        repeat:
          s.recurrenceType === 'interval' && s.recurrenceInterval === 28
            ? 'monthly'
            : s.recurrenceType === 'interval'
              ? 'fortnightly'
              : 'weekly',
        room: s.room || '',
        label: s.label || '',
      })),
    )
    // Only re-hydrate on open / when the existing set identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingSlots.length])

  const patchClass = (key, p) =>
    setClassTimes((rows) => rows.map((r) => (r.key === key ? { ...r, ...p } : r)))

  async function syncClassTimes(uid, targetModeId, subjectId, color, name) {
    const keptIds = new Set(classTimes.filter((r) => r.id).map((r) => r.id))
    // Deletions
    for (const s of existingSlots) {
      if (!keptIds.has(s.id)) await deleteSlot(uid, targetModeId, s.id).catch(() => {})
    }
    // Creates + updates
    const todayStr = new Date().toISOString().split('T')[0]
    for (const r of classTimes) {
      if (r.endMin <= r.startMin) continue
      const t = CLASS_TYPES[r.type] || CLASS_TYPES.other
      const rep = REPEATS[r.repeat] || REPEATS.weekly
      const payload = {
        label: (r.label || '').trim() || t.label || name,
        dayOfWeek: r.dayOfWeek,
        startMin: r.startMin,
        endMin: r.endMin,
        color,
        subjectId,
        room: (r.room || '').trim(),
        tag: t.tag,
        tagStyle: t.tagStyle,
        recurrenceType: rep.recurrenceType,
        recurrenceInterval: rep.recurrenceInterval || 1,
        recurrenceStartDate: todayStr,
      }
      if (r.id) await updateSlot(uid, targetModeId, r.id, payload).catch(() => {})
      else await addSlot(uid, targetModeId, payload).catch(() => {})
    }
  }

  const save = async () => {
    const name = draft.name.trim()
    if (!name) return toast.error('Name your subject')
    const targetModeId = isEdit ? (subject?._modeId || propModeId) : (isGlobalScope ? selectedModeId : (propModeId || modes[0]?.id))
    if (!targetModeId || targetModeId === 'all') {
      return toast.error('Please select a mode for this subject')
    }

    setSaving(true)
    try {
      let subjectId = subject?.id
      if (isEdit) {
        await updateSubject(user.uid, targetModeId, subject.id, {
          name,
          color: draft.color,
          targetHours: Number(draft.targetHours) || 0,
        })
      } else {
        const ref = await addSubject(user.uid, targetModeId, {
          name,
          color: draft.color,
          targetHours: Number(draft.targetHours) || 0,
          order: order || 0,
        })
        subjectId = ref?.id || ref
      }
      if (subjectId) {
        await syncClassTimes(user.uid, targetModeId, subjectId, draft.color, name)
      }
      onClose()
    } catch (err) {
      console.error('[subject] save failed', err)
      toast.error('Could not save subject')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const targetModeId = subject?._modeId || propModeId
    setSaving(true)
    try {
      await deleteSubject(user.uid, targetModeId, subject.id)
      onDeleted?.(subject.id)
      onClose()
    } catch (err) {
      console.error('[subject] delete failed', err)
      toast.error('Could not delete subject')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit subject' : 'New subject'}
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
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      {isGlobalScope && modes?.length > 0 && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted">Mode</label>
          <div className="flex flex-wrap gap-2">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedModeId(m.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all',
                  selectedModeId === m.id
                    ? 'border-accent bg-accent/15 text-accent shadow-xs'
                    : 'border-line bg-surface-2/40 text-muted hover:text-ink',
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: m.accentColor || '#6366f1' }}
                />
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="mb-1.5 block text-xs font-medium text-muted">Name</label>
      <input
        autoFocus
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="e.g. Indian Polity"
        className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />

      <label className="mb-1.5 mt-4 block text-xs font-medium text-muted">
        Target hours (optional)
      </label>
      <input
        type="number"
        min="0"
        value={draft.targetHours}
        onChange={(e) => setDraft((d) => ({ ...d, targetHours: e.target.value }))}
        className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
      />

      <label className="mb-2 mt-4 block text-xs font-medium text-muted">Color</label>
      <div className="flex flex-wrap gap-2">
        {MODE_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setDraft((d) => ({ ...d, color: c }))}
            className={cn(
              'h-8 w-8 rounded-full transition-transform',
              draft.color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface' : 'hover:scale-105',
            )}
            style={{ backgroundColor: c, '--tw-ring-color': c }}
            aria-label={c}
          />
        ))}
      </div>

      {/* Class / lab times — land on the timetable, coloured by this subject */}
      <div className="mt-5 border-t border-line/50 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarClock className="h-3.5 w-3.5" /> Class / lab times
          </span>
          <button
            type="button"
            onClick={() => setClassTimes((r) => [...r, blankClass()])}
            className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
          >
            <Plus className="h-3 w-3" /> Add time
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {classTimes.map((r) => (
            <div key={r.key} className="rounded-xl border border-line/50 bg-surface-2/20 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={r.type}
                  onChange={(e) => patchClass(r.key, { type: e.target.value })}
                  className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-xs outline-none focus:border-accent"
                >
                  <option value="lecture">Lecture</option>
                  <option value="lab">Lab</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="seminar">Seminar</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={r.dayOfWeek}
                  onChange={(e) => patchClass(r.key, { dayOfWeek: Number(e.target.value) })}
                  className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-xs outline-none focus:border-accent"
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={toTime(r.startMin)}
                  onChange={(e) => patchClass(r.key, { startMin: fromTime(e.target.value) })}
                  className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <span className="text-[11px] text-muted">–</span>
                <input
                  type="time"
                  value={toTime(r.endMin)}
                  onChange={(e) => patchClass(r.key, { endMin: fromTime(e.target.value) })}
                  className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setClassTimes((rows) => rows.filter((x) => x.key !== r.key))}
                  className="ml-auto shrink-0 text-muted hover:text-rose-400"
                  aria-label="Remove class time"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <select
                  value={r.repeat}
                  onChange={(e) => patchClass(r.key, { repeat: e.target.value })}
                  className="rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-[11px] outline-none focus:border-accent"
                  title="How often this class repeats"
                >
                  <option value="weekly">Every week</option>
                  <option value="fortnightly">Every 2 weeks</option>
                  <option value="monthly">Every 4 weeks</option>
                </select>
                <input
                  value={r.room}
                  onChange={(e) => patchClass(r.key, { room: e.target.value })}
                  placeholder="Room / venue"
                  className="w-28 rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-[11px] outline-none focus:border-accent"
                />
                <input
                  value={r.label}
                  onChange={(e) => patchClass(r.key, { label: e.target.value })}
                  placeholder="Custom label (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2/60 px-2 py-1.5 text-[11px] outline-none focus:border-accent"
                />
              </div>
            </div>
          ))}
          {!classTimes.length && (
            <span className="text-[11px] text-muted">
              Add lecture / lab / tutorial times — with a repeat and room — so this subject
              fills your timetable. Same class twice a week? Add two rows.
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}
