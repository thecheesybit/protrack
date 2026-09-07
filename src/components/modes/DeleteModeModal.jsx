import { useState, useEffect } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { deleteMode } from '@/services/modeService'
import { updateActiveMode } from '@/services/userService'
import { getIcon } from '@/lib/icons'

/**
 * Modal that asks the user to type "delete" to confirm deleting a workspace mode.
 */
export function DeleteModeModal({ open, onClose, mode }) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const setActiveModeId = useStore((s) => s.setActiveModeId)

  const [confirmInput, setConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (open) {
      setConfirmInput('')
      setDeleting(false)
    }
  }, [open])

  if (!mode) return null

  const Icon = getIcon(mode.icon)
  const isMatch = confirmInput.trim().toLowerCase() === 'delete'

  const handleDelete = async () => {
    if (!isMatch) return
    if (modes.length <= 1) {
      toast.error('Keep at least one mode')
      return
    }

    setDeleting(true)
    try {
      await deleteMode(user.uid, mode.id)
      if (activeModeId === mode.id) {
        const next = modes.find((m) => m.id !== mode.id)
        if (next) {
          setActiveModeId(next.id)
          await updateActiveMode(user.uid, next.id)
        }
      }
      toast.success(`Mode "${mode.name}" deleted`)
      onClose()
    } catch (err) {
      console.error('[mode] failed to delete mode', err)
      toast.error('Could not delete mode')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Mode"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={!isMatch || deleting}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete Mode'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Mode Preview Banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-line/70 bg-surface-2/40 p-3.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: mode.accentColor || '#6366f1' }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-ink">{mode.name}</h4>
            <p className="text-xs text-muted">Workspace Mode</p>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-500">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            This action cannot be undone. All timetable slots, subjects, and goals associated with this mode will be permanently removed.
          </p>
        </div>

        {/* Confirmation prompt */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">
            To confirm deletion, type <span className="font-mono font-bold text-rose-400 select-all">delete</span> below:
          </label>
          <input
            autoFocus
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isMatch && !deleting) {
                handleDelete()
              }
            }}
            placeholder='Type "delete" to confirm'
            className="w-full rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-rose-500 font-mono"
          />
        </div>
      </div>
    </Modal>
  )
}
