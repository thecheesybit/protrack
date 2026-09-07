import { useEffect, useState } from 'react'
import { Trash2, AlertTriangle, Undo2, Layers, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { MODE_PALETTE } from '@/lib/constants'
import {
  addExam,
  updateExam,
  softDeleteExam,
  restoreExam,
  moveExamToMode,
  EXAM_RETENTION_DAYS,
} from '@/services/examService'
import { cn } from '@/utils/cn'

const EXAM_CATEGORIES = [
  'Banking & Insurance',
  'SSC & Railways',
  'UPSC & Civil Services',
  'Engineering & GATE',
  'Management & CAT',
  'Defense & Police',
  'State PSC',
  'Custom / Academic',
]

export function ExamEditorModal({
  open,
  onClose,
  modeId: propModeId,
  exam,
  order = 0,
  onDeleted,
}) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const isEdit = Boolean(exam?.id)
  const currentModeId = exam?._modeId || propModeId

  const [name, setName] = useState('')
  const [targetModeId, setTargetModeId] = useState(currentModeId)
  const [category, setCategory] = useState(EXAM_CATEGORIES[0])
  const [color, setColor] = useState(MODE_PALETTE[0])
  const [targetScore, setTargetScore] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [targetAccuracy, setTargetAccuracy] = useState('85')
  const [targetPercentile, setTargetPercentile] = useState('90')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false)
      return
    }
    if (exam) {
      setName(exam.name || '')
      setTargetModeId(exam._modeId || propModeId)
      setCategory(exam.category || EXAM_CATEGORIES[0])
      setColor(exam.color || MODE_PALETTE[0])
      setTargetScore(exam.targetScore != null ? String(exam.targetScore) : '')
      setTotalMarks(exam.totalMarks != null ? String(exam.totalMarks) : '')
      setTargetAccuracy(exam.targetAccuracy != null ? String(exam.targetAccuracy) : '85')
      setTargetPercentile(exam.targetPercentile != null ? String(exam.targetPercentile) : '90')
    } else {
      setName('')
      setTargetModeId(propModeId)
      setCategory(EXAM_CATEGORIES[0])
      setColor(MODE_PALETTE[order % MODE_PALETTE.length])
      setTargetScore('')
      setTotalMarks('')
      setTargetAccuracy('85')
      setTargetPercentile('90')
    }
  }, [open, exam, propModeId, order])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Please enter an exam name')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: trimmed,
        category,
        color,
        targetScore: targetScore !== '' ? Number(targetScore) : 0,
        totalMarks: totalMarks !== '' ? Number(totalMarks) : 0,
        targetAccuracy: targetAccuracy !== '' ? Number(targetAccuracy) : 85,
        targetPercentile: targetPercentile !== '' ? Number(targetPercentile) : 90,
        order: exam?.order ?? order,
      }

      if (isEdit) {
        if (targetModeId && targetModeId !== currentModeId) {
          await moveExamToMode(user.uid, currentModeId, targetModeId, exam.id, payload)
          toast.success(`Exam and attempts migrated to new scope!`)
        } else {
          await updateExam(user.uid, currentModeId, exam.id, payload)
          toast.success('Exam settings updated!')
        }
      } else {
        await addExam(user.uid, targetModeId || currentModeId, payload)
        toast.success('Exam created!')
      }
      onClose()
    } catch (err) {
      console.error('[ExamEditor] save error:', err)
      toast.error('Could not save exam')
    } finally {
      setSaving(false)
    }
  }

  const handleSoftDelete = async () => {
    setSaving(true)
    try {
      await softDeleteExam(user.uid, currentModeId, exam.id)
      onDeleted?.(exam.id)
      toast((t) => (
        <div className="flex items-center justify-between gap-3 text-xs w-full">
          <span>Moved to Trash (15 days to restore)</span>
          <button
            onClick={async () => {
              try {
                await restoreExam(user.uid, currentModeId, exam.id)
                toast.dismiss(t.id)
                toast.success(`Exam "${exam.name}" restored!`)
              } catch (e) {
                toast.error('Failed to restore exam')
              }
            }}
            className="rounded-lg bg-accent px-2.5 py-1 font-bold text-white hover:opacity-90 shadow-sm"
          >
            Undo
          </button>
        </div>
      ), { duration: 8000 })
      onClose()
    } catch (err) {
      console.error('[ExamEditor] delete error:', err)
      toast.error('Could not delete exam')
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Manage Exam: ${exam?.name}` : 'Add New Exam'}
      className="max-w-md"
      footer={
        <>
          {isEdit && !showDeleteConfirm && (
            <Button
              size="sm"
              variant="ghost"
              className="mr-auto text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete Exam
            </Button>
          )}
          {!showDeleteConfirm && (
            <>
              <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Exam'}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {showDeleteConfirm ? (
          /* Delete Confirmation with 15-Day Restore Guarantee */
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2.5 text-rose-300">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-rose-200">Move "{exam?.name}" to Trash?</h4>
                <p className="text-xs text-rose-300/80 mt-1 leading-relaxed">
                  All attempt records and mistake notes will be moved to Trash.
                  You can <strong>restore it anytime within {EXAM_RETENTION_DAYS} days</strong>.
                  After 15 days, it will be automatically removed permanently.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-500/20">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                className="text-xs"
              >
                Keep Exam
              </Button>
              <Button
                size="sm"
                onClick={handleSoftDelete}
                disabled={saving}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Move to Trash (15 Days)
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Exam Name (Rename) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">
                Exam Name {isEdit && <span className="text-[10px] text-accent font-normal">(Rename)</span>}
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. RRB PO 2026, IBPS Clerk, SSC CGL"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
              />
            </div>

            {/* Scope / Study Mode Selection */}
            {modes && modes.length > 0 && (
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-accent" /> Target Scope / Mode
                  </span>
                  {isEdit && targetModeId !== currentModeId && (
                    <span className="text-[10px] text-amber-400 font-semibold">
                      Will migrate exam & attempts
                    </span>
                  )}
                </label>
                <select
                  value={targetModeId}
                  onChange={(e) => setTargetModeId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
                >
                  {modes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.id === currentModeId ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
              >
                {EXAM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Color Palette */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Badge Color</label>
              <div className="flex flex-wrap gap-2">
                {MODE_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-6 w-6 rounded-full transition-transform',
                      color === c ? 'scale-125 ring-2 ring-white shadow-md' : 'hover:scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Target Goals & Values */}
            <div className="rounded-xl border border-line/50 bg-surface-2/30 p-3">
              <span className="mb-2 block text-[11px] font-semibold text-muted uppercase tracking-wider">
                Target Benchmark Values
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-[10px] text-muted">Target Score</label>
                  <input
                    type="number"
                    value={targetScore}
                    onChange={(e) => setTargetScore(e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted">Total Marks</label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    placeholder="e.g. 80"
                    className="w-full rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted">Target Accuracy %</label>
                  <input
                    type="number"
                    value={targetAccuracy}
                    onChange={(e) => setTargetAccuracy(e.target.value)}
                    placeholder="85"
                    className="w-full rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted">Target Percentile %</label>
                  <input
                    type="number"
                    value={targetPercentile}
                    onChange={(e) => setTargetPercentile(e.target.value)}
                    placeholder="90"
                    className="w-full rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* 15-Day Restore Guarantee Hint */}
            {isEdit && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted/70 px-1">
                <Clock className="h-3 w-3 text-accent" />
                <span>Deleting moves this exam to Trash. You can restore it anytime for 15 days.</span>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
