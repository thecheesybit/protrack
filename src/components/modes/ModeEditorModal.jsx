import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE } from '@/lib/constants'
import { MODE_ICON_NAMES, getIcon } from '@/lib/icons'
import { createMode, updateMode, deleteMode } from '@/services/modeService'
import { updateActiveMode } from '@/services/userService'
import { cn } from '@/utils/cn'

const EMPTY = { name: '', icon: 'Layers', accentColor: MODE_PALETTE[0] }

/**
 * Create or edit a workspace mode. `mode === null` => create flow.
 */
export function ModeEditorModal({ open, onClose, mode, onDeleteRequest }) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const setActiveModeId = useStore((s) => s.setActiveModeId)

  const [draft, setDraft] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteTypedText, setDeleteTypedText] = useState('')

  const isEdit = Boolean(mode)

  useEffect(() => {
    if (!open) return
    setConfirmingDelete(false)
    setDeleteTypedText('')
    setDraft(
      mode
        ? { name: mode.name, icon: mode.icon, accentColor: mode.accentColor }
        : { ...EMPTY, accentColor: MODE_PALETTE[modes.length % MODE_PALETTE.length] },
    )
  }, [open, mode, modes.length])

  const save = async () => {
    const name = draft.name.trim()
    if (!name) return toast.error('Give your mode a name')
    setSaving(true)
    try {
      if (isEdit) {
        await updateMode(user.uid, mode.id, {
          name,
          icon: draft.icon,
          accentColor: draft.accentColor,
        })
        toast.success('Mode updated')
      } else {
        const ref = await createMode(user.uid, {
          name,
          icon: draft.icon,
          accentColor: draft.accentColor,
          order: modes.length,
        })
        setActiveModeId(ref.id)
        await updateActiveMode(user.uid, ref.id)
        toast.success('Mode created')
      }
      onClose()
    } catch (err) {
      console.error('[mode] save failed', err)
      toast.error('Could not save mode')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (modes.length <= 1) return toast.error('Keep at least one mode')
    if (deleteTypedText.trim().toLowerCase() !== 'delete') {
      return toast.error('Type "delete" to confirm')
    }
    setSaving(true)
    try {
      await deleteMode(user.uid, mode.id)
      if (activeModeId === mode.id) {
        const next = modes.find((m) => m.id !== mode.id)
        if (next) {
          setActiveModeId(next.id)
          await updateActiveMode(user.uid, next.id)
        }
      }
      toast.success('Mode deleted')
      onClose()
    } catch (err) {
      console.error('[mode] delete failed', err)
      toast.error('Could not delete mode')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Rename & Edit mode' : 'New mode'}
      footer={
        <>
          {isEdit &&
            (onDeleteRequest ? (
              <Button
                size="sm"
                variant="ghost"
                className="mr-auto text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                onClick={() => {
                  onClose()
                  onDeleteRequest(mode)
                }}
                disabled={modes.length <= 1}
                title={modes.length <= 1 ? 'Keep at least one mode' : `Delete ${mode.name}`}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : confirmingDelete ? (
              <div className="mr-auto flex items-center gap-2">
                <input
                  autoFocus
                  value={deleteTypedText}
                  onChange={(e) => setDeleteTypedText(e.target.value)}
                  placeholder='Type "delete"'
                  className="w-24 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs font-mono outline-none focus:border-rose-500"
                />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={remove}
                  disabled={saving || deleteTypedText.trim().toLowerCase() !== 'delete'}
                >
                  Confirm
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false)
                    setDeleteTypedText('')
                  }}
                  className="text-xs text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="mr-auto text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                onClick={() => setConfirmingDelete(true)}
                disabled={modes.length <= 1}
                title={modes.length <= 1 ? 'Keep at least one mode' : `Delete ${mode.name}`}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ))}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {isEdit ? 'Save Changes' : 'Create Mode'}
          </Button>
        </>
      }
    >
      {/* Name / Rename */}
      <label className="mb-1.5 block text-xs font-medium text-muted">
        {isEdit ? 'Mode name (rename)' : 'Mode name'}
      </label>
      <input
        autoFocus
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        placeholder="e.g. UPSC Mode"
        className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent"
      />

      {/* Color */}
      <label className="mb-2 mt-5 block text-xs font-medium text-muted">Accent</label>
      <div className="flex flex-wrap gap-2">
        {MODE_PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setDraft((d) => ({ ...d, accentColor: c }))}
            className={cn(
              'h-8 w-8 rounded-full transition-transform',
              draft.accentColor === c
                ? 'scale-110 ring-2 ring-offset-2 ring-offset-surface'
                : 'hover:scale-105',
            )}
            style={{ backgroundColor: c, '--tw-ring-color': c }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      {/* Icon */}
      <label className="mb-2 mt-5 block text-xs font-medium text-muted">Icon</label>
      <div className="grid grid-cols-8 gap-1.5">
        {MODE_ICON_NAMES.map((name) => {
          const Icon = getIcon(name)
          const active = draft.icon === name
          return (
            <button
              key={name}
              onClick={() => setDraft((d) => ({ ...d, icon: name }))}
              className={cn(
                'flex aspect-square items-center justify-center rounded-xl border transition-colors',
                active
                  ? 'border-transparent text-white'
                  : 'border-line text-muted hover:text-ink',
              )}
              style={active ? { backgroundColor: draft.accentColor } : undefined}
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
