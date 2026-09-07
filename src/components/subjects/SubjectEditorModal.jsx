import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE } from '@/lib/constants'
import { addSubject, updateSubject, deleteSubject } from '@/services/subjectService'
import { cn } from '@/utils/cn'

export function SubjectEditorModal({ open, onClose, modeId: propModeId, subject, order, onDeleted }) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const isEdit = Boolean(subject?.id)
  const isGlobalScope = (propModeId === 'all' || !propModeId) && !isEdit
  const initialModeId = subject?._modeId || (propModeId && propModeId !== 'all' ? propModeId : modes[0]?.id)
  const [selectedModeId, setSelectedModeId] = useState(initialModeId)
  const [draft, setDraft] = useState({ name: '', color: MODE_PALETTE[0], targetHours: 0 })
  const [saving, setSaving] = useState(false)

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

  const save = async () => {
    const name = draft.name.trim()
    if (!name) return toast.error('Name your subject')
    const targetModeId = isEdit ? (subject?._modeId || propModeId) : (isGlobalScope ? selectedModeId : (propModeId || modes[0]?.id))
    if (!targetModeId || targetModeId === 'all') {
      return toast.error('Please select a mode for this subject')
    }

    setSaving(true)
    try {
      if (isEdit) {
        await updateSubject(user.uid, targetModeId, subject.id, {
          name,
          color: draft.color,
          targetHours: Number(draft.targetHours) || 0,
        })
      } else {
        await addSubject(user.uid, targetModeId, {
          name,
          color: draft.color,
          targetHours: Number(draft.targetHours) || 0,
          order: order || 0,
        })
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
    </Modal>
  )
}
