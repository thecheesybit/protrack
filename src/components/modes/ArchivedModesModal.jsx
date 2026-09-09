import { useState } from 'react'
import { ArchiveRestore, Trash2, Archive } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { getIcon } from '@/lib/icons'
import { unarchiveMode, deleteMode } from '@/services/modeService'

export function ArchivedModesModal({ open, onClose, archivedModes = [] }) {
  const { user } = useAuth()
  const [busyId, setBusyId] = useState(null)

  const handleRestore = async (mode) => {
    if (!user) return
    setBusyId(mode.id)
    try {
      await unarchiveMode(user.uid, mode.id)
      toast.success(`"${mode.name}" restored`)
      if (archivedModes.length <= 1) {
        onClose()
      }
    } catch (err) {
      console.error('[mode] restore failed', err)
      toast.error('Could not restore mode')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (mode) => {
    if (!user) return
    if (!window.confirm(`Permanently delete "${mode.name}" and all its subjects/slots?`)) return
    setBusyId(mode.id)
    try {
      await deleteMode(user.uid, mode.id)
      toast.success(`"${mode.name}" deleted`)
      if (archivedModes.length <= 1) {
        onClose()
      }
    } catch (err) {
      console.error('[mode] permanent delete failed', err)
      toast.error('Could not delete mode')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Archived Modes"
      description="Archived modes are hidden from your active workspace but preserve all their tasks, slots, and subjects."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-3 py-1">
        {archivedModes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-muted">
              <Archive className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">No archived modes</p>
            <p className="mt-1 text-xs text-muted">
              Right-click any mode on the rail to archive it.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line/40 rounded-2xl border border-line/60 bg-surface/50 overflow-hidden">
            {archivedModes.map((mode) => {
              const Icon = getIcon(mode.icon)
              const isBusy = busyId === mode.id
              return (
                <div
                  key={mode.id}
                  className="flex items-center justify-between p-3.5 transition-colors hover:bg-surface-2/40"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: mode.accentColor || '#6366f1' }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{mode.name}</p>
                      <p className="text-xs text-muted">Archived</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRestore(mode)}
                      disabled={isBusy}
                      className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 gap-1.5 text-xs h-8 px-2.5"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(mode)}
                      disabled={isBusy}
                      className="text-muted hover:text-rose-500 hover:bg-rose-500/10 h-8 w-8 p-0"
                      title="Permanently delete"
                      aria-label={`Permanently delete ${mode.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
