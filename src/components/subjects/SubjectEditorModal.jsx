import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE } from '@/lib/constants'
import { addSubject, updateSubject, deleteSubject } from '@/services/subjectService'
import { cn } from '@/utils/cn'

export function SubjectEditorModal({ open, onClose, modeId: propModeId, subject, order, onDeleted }) {
  const { user } = useAuth()
  const modeId = subject?._modeId || propModeId
  const isEdit = Boolean(subject?.id)
  const [draft, setDraft] = useState({ name: '', color: MODE_PALETTE[0], targetHours: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(
      subject
        ? {
            name: subject.name,
            color: subject.color,
            targetHours: subject.targetHours || 0,
          }
        : { name: '', color: MODE_PALETTE[(order || 0) % MODE_PALETTE.length], targetHours: 0 },
    )
  }, [open, subject, order])

  const save = async () => {
    const name = draft.name.trim()
    if (!name) return toast.error('Name your subject')
    setSaving(true)
    try {
      if (isEdit) {
        await updateSubject(user.uid, modeId, subject.id, {
          name,
          color: draft.color,
          targetHours: Number(draft.targetHours) || 0,
        })
      } else {
        await addSubject(user.uid, modeId, {
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
    setSaving(true)
    try {
      await deleteSubject(user.uid, modeId, subject.id)
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
