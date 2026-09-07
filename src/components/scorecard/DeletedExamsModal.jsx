import { useState } from 'react'
import { Undo2, Trash2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { getExamDaysRemaining, restoreExam, permanentDeleteExam } from '@/services/examService'

export function DeletedExamsModal({
  open,
  onClose,
  deletedExams = [],
  activeModeId,
  onRestored,
}) {
  const { user } = useAuth()
  const [busyId, setBusyId] = useState(null)

  const handleRestore = async (exam) => {
    setBusyId(exam.id)
    try {
      const modeId = exam._modeId || activeModeId
      await restoreExam(user.uid, modeId, exam.id)
      toast.success(`Exam "${exam.name}" restored!`)
      onRestored?.(exam.id)
      if (deletedExams.length <= 1) {
        onClose()
      }
    } catch (err) {
      console.error('[restoreExam] failed', err)
      toast.error('Failed to restore exam')
    } finally {
      setBusyId(null)
    }
  }

  const handlePermanentDelete = async (exam) => {
    if (!confirm(`Permanently delete "${exam.name}" and all its attempt records? This CANNOT be undone.`)) return
    setBusyId(exam.id)
    try {
      const modeId = exam._modeId || activeModeId
      await permanentDeleteExam(user.uid, modeId, exam.id, true)
      toast.success('Exam permanently deleted')
      if (deletedExams.length <= 1) {
        onClose()
      }
    } catch (err) {
      console.error('[permanentDelete] failed', err)
      toast.error('Failed to delete permanently')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recently Deleted Exams (15-Day Trash)"
      className="max-w-lg"
      footer={
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200/90 flex items-start gap-2">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Exams in Trash are preserved with all mock attempts and mistake notes for <strong>15 days</strong>.
            After 15 days, they will be automatically removed permanently.
          </span>
        </div>

        {deletedExams.length === 0 ? (
          <div className="py-8 text-center text-muted text-xs">
            Trash is currently empty.
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
            {deletedExams.map((ex) => {
              const daysLeft = getExamDaysRemaining(ex.deletedAt)
              const isBusy = busyId === ex.id

              return (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line/60 bg-surface-2/40 p-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: ex.color || 'var(--accent)' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-ink truncate">{ex.name}</span>
                        {ex.category && (
                          <span className="rounded bg-surface px-1.5 py-0.2 text-[10px] text-muted">
                            {ex.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
                        <span className="text-amber-400 font-medium">{daysLeft} days left to restore</span>
                        {ex._modeName && <span>• Scope: {ex._modeName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRestore(ex)}
                      disabled={isBusy}
                      className="text-accent hover:bg-accent/10 h-8 px-2.5 text-xs font-semibold"
                    >
                      <Undo2 className="h-3.5 w-3.5 mr-1" /> Restore
                    </Button>
                    <button
                      onClick={() => handlePermanentDelete(ex)}
                      disabled={isBusy}
                      className="rounded-lg p-2 text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
