import { useState, useRef } from 'react'
import {
  Trophy,
  Target,
  Percent,
  Clock,
  AlertCircle,
  Pencil,
  Plus,
  X,
  Layers,
  Calendar,
  Sparkles,
  Copy,
  Check,
  Loader2,
} from 'lucide-react'
import { toBlob, toPng } from 'html-to-image'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { addMistakeToScorecard, removeMistakeFromScorecard } from '@/services/scorecardService'
import { cn } from '@/utils/cn'

const MISTAKE_TAGS = [
  { id: 'silly', label: 'Silly Mistake', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { id: 'speed', label: 'Speed Trap', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'concept', label: 'Concept Gap', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { id: 'calculation', label: 'Calculation Slip', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { id: 'misread', label: 'Misread Question', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { id: 'formula', label: 'Formula Miss', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { id: 'guess', label: 'Negative Guess', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
]

export function ScorecardDetailModal({
  open,
  onClose,
  scorecard,
  modeId: propModeId,
  onEdit,
}) {
  const { user } = useAuth()
  const cardRef = useRef(null)
  const [addingMistake, setAddingMistake] = useState(false)
  const [newMistake, setNewMistake] = useState({
    tag: 'silly',
    topic: '',
    questionNo: '',
    note: '',
  })
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  if (!scorecard) return null

  const targetModeId = scorecard._modeId || scorecard.modeId || propModeId
  const scorePct = scorecard.totalMarks
    ? Math.round(((scorecard.score || 0) / scorecard.totalMarks) * 100)
    : 0

  const totalQuestions =
    scorecard.totalQuestions ||
    (scorecard.correct || 0) + (scorecard.wrong || 0) + (scorecard.unattempted || 0)

  const handleAddMistake = async () => {
    const tagInfo = MISTAKE_TAGS.find((t) => t.id === newMistake.tag)
    const noteText = newMistake.note.trim() || newMistake.topic.trim() || `${tagInfo?.label || 'Mistake'}`

    try {
      await addMistakeToScorecard(user.uid, targetModeId, scorecard, {
        ...newMistake,
        note: noteText,
      })
      toast.success('Mistake logged to this exam!')
      setNewMistake({ tag: 'silly', topic: '', questionNo: '', note: '' })
      setAddingMistake(false)
    } catch (err) {
      console.error('[detail] add mistake failed:', err)
      toast.error('Could not log mistake')
    }
  }

  const handleRemoveMistake = async (mistakeId) => {
    try {
      await removeMistakeFromScorecard(user.uid, targetModeId, scorecard, mistakeId)
      toast.success('Mistake removed')
    } catch (err) {
      console.error('[detail] remove mistake failed:', err)
      toast.error('Could not remove mistake')
    }
  }

  const mistakes = scorecard.mistakes || []

  const handleCopyAsImage = async () => {
    if (!cardRef.current || isCopying) return
    setIsCopying(true)
    try {
      // Allow any active paint/layout to complete
      await new Promise((r) => setTimeout(r, 60))
      const element = cardRef.current

      // Calculate full natural dimensions of the card with generous clearance
      const paddingX = 28
      const paddingTop = 28
      const paddingBottom = 56
      const naturalWidth = Math.ceil(Math.max(element.scrollWidth, element.offsetWidth, element.getBoundingClientRect().width, 660))
      const naturalHeight = Math.ceil(Math.max(element.scrollHeight, element.offsetHeight, element.getBoundingClientRect().height))
      const totalWidth = naturalWidth + paddingX * 2
      const totalHeight = naturalHeight + paddingTop + paddingBottom + 60

      const imageOptions = {
        width: totalWidth,
        height: totalHeight,
        pixelRatio: 2,
        backgroundColor: '#0c0f18',
        cacheBust: true,
        style: {
          maxHeight: 'none',
          height: `${totalHeight}px`,
          width: `${totalWidth}px`,
          boxSizing: 'border-box',
          overflow: 'visible',
          borderRadius: '24px',
          padding: `${paddingTop}px ${paddingX}px ${paddingBottom}px ${paddingX}px`,
          background: 'linear-gradient(160deg, #0d111d 0%, #080a11 100%)',
        },
        filter: (node) => {
          if (node?.getAttribute && node.getAttribute('data-export-hide') === 'true') {
            return false
          }
          return true
        },
      }

      const blob = await toBlob(element, imageOptions)

      if (!blob) throw new Error('Could not generate image blob')

      let copied = false

      // 1. Try standard async clipboard API
      if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        try {
          const item = new ClipboardItem({ 'image/png': blob })
          await navigator.clipboard.write([item])
          copied = true
        } catch (clipErr) {
          console.warn('[copyImage] navigator.clipboard.write failed, falling back:', clipErr)
        }
      }

      // 2. Try desktop Electron native clipboard
      if (!copied && window.protrack?.clipboard?.writeImage) {
        try {
          const dataUrl = await toPng(element, imageOptions)
          const ok = await window.protrack.clipboard.writeImage(dataUrl)
          if (ok) copied = true
        } catch (ipcErr) {
          console.warn('[copyImage] desktop clipboard IPC failed:', ipcErr)
        }
      }

      if (copied) {
        setIsCopied(true)
        toast.success('Report card image copied to clipboard! Ready to paste & share.', {
          icon: '📋',
          duration: 3500,
        })
        setTimeout(() => setIsCopied(false), 2500)
      } else {
        // 3. Fallback: Save file directly as PNG download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const safeExam = (scorecard.examName || 'Exam').replace(/\s+/g, '_')
        const safeTitle = (scorecard.title || 'Report').replace(/\s+/g, '_')
        a.href = url
        a.download = `${safeExam}_${safeTitle}.png`
        a.click()
        URL.revokeObjectURL(url)
        setIsCopied(true)
        toast.success('Report card PNG downloaded!', { icon: '📥' })
        setTimeout(() => setIsCopied(false), 2500)
      }
    } catch (err) {
      console.error('[copyImage] error:', err)
      toast.error(`Could not generate image: ${err?.message || 'Error'}`)
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="font-bold text-base truncate">{scorecard.title}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
              scorecard.type === 'flt'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-accent/20 text-accent'
            )}
          >
            {scorecard.type === 'flt' ? 'FLT' : 'Sectional'}
          </span>
        </div>
      }
      headerExtra={
        <button
          type="button"
          onClick={handleCopyAsImage}
          disabled={isCopying}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all select-none',
            isCopied
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400 shadow-sm'
              : 'border-line/70 bg-surface/80 text-muted hover:border-accent/60 hover:bg-accent/10 hover:text-accent active:scale-95'
          )}
          title="Generate PNG image and copy to clipboard to share"
          aria-label="Copy report card as image"
        >
          {isCopying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              <span className="hidden sm:inline">Generating...</span>
            </>
          ) : isCopied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-bold hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copy Image</span>
            </>
          )}
        </button>
      }
      className="max-w-2xl"
      footer={
        <>
          <Button
            size="sm"
            variant="ghost"
            className="mr-auto text-muted hover:text-ink"
            onClick={() => {
              onClose()
              onEdit?.(scorecard)
            }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Attempt
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="max-h-[72vh] overflow-y-auto pr-1">
        <div ref={cardRef} className="flex flex-col gap-4">
        {/* Exam Title & Type Header Banner (included in PNG export) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-lg text-ink tracking-tight">{scorecard.title}</span>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                scorecard.type === 'flt'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-accent/20 text-accent border border-accent/30'
              )}
            >
              {scorecard.type === 'flt' ? 'Full Length Test' : 'Sectional Mock'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="font-mono text-ink/90 font-bold bg-surface-2/60 px-2 py-0.5 rounded-md border border-line/40">
              Attempt #{scorecard.serialNo || 1}
            </span>
            {scorecard.attemptDate && (
              <span className="flex items-center gap-1 text-muted">
                <Calendar className="h-3 w-3" />
                {new Date(scorecard.attemptDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Scope, Date, Serial metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-3 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-2">
            {scorecard.examName && (
              <span className="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent border border-accent/25">
                <Trophy className="h-3 w-3" /> {scorecard.examName}
              </span>
            )}
            {scorecard._modeName && (
              <span
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-white shadow-sm"
                style={{ backgroundColor: scorecard._modeColor || 'var(--accent)' }}
              >
                <Layers className="h-3 w-3" /> {scorecard._modeName}
              </span>
            )}
            <span className="font-medium text-ink">
              {scorecard.sectionName}
              {scorecard.topicName ? ` • ${scorecard.topicName}` : ''}
            </span>
          </div>
        </div>

        {/* ── Top Hero KPI Strip ─────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Score Banner */}
          <div className="col-span-2 rounded-2xl border border-line/60 bg-gradient-to-br from-surface to-surface-2 p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Score Achieved</span>
              {scorecard.negativeMarks > 0 && (
                <span className="text-[11px] text-rose-400 font-medium">
                  -{scorecard.negativeMarks} Neg
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-ink tracking-tight">
                {scorecard.score}
              </span>
              <span className="text-sm text-muted font-medium">
                / {scorecard.totalMarks || 0} ({scorePct}%)
              </span>
            </div>
            <div className="mt-2">
              <ProgressBar value={scorePct} height="h-2" />
            </div>
          </div>

          {/* Percentile Pill */}
          <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-3 flex flex-col justify-between">
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Percent className="h-3 w-3 text-accent" /> Percentile
            </span>
            <div className="my-1">
              <span className="text-2xl font-black text-accent tracking-tight">
                {scorecard.percentile != null ? `${scorecard.percentile}%` : 'N/A'}
              </span>
            </div>
            <span className="text-[10px] text-muted">vs all candidates</span>
          </div>

          {/* Accuracy Pill */}
          <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-3 flex flex-col justify-between">
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Target className="h-3 w-3 text-emerald-400" /> Accuracy
            </span>
            <div className="my-1">
              <span className="text-2xl font-black text-emerald-400 tracking-tight">
                {scorecard.accuracy != null ? `${scorecard.accuracy}%` : 'N/A'}
              </span>
            </div>
            <span className="text-[10px] text-muted">precision rate</span>
          </div>
        </div>

        {/* ── Sub Metrics: Rank, Time Spent ──────────────────────── */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-line/60 bg-surface-2/20 px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <div>
                <span className="block text-[10px] text-muted">Overall Rank</span>
                <span className="text-sm font-bold text-ink">
                  {scorecard.rank != null ? scorecard.rank.toLocaleString() : 'N/A'}
                  {scorecard.totalCandidates ? (
                    <span className="text-xs text-muted font-normal"> / {scorecard.totalCandidates.toLocaleString()}</span>
                  ) : null}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line/60 bg-surface-2/20 px-3.5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              <div>
                <span className="block text-[10px] text-muted">Time Consumed</span>
                <span className="text-sm font-bold text-ink">
                  {scorecard.timeSpent || (scorecard.timeSpentMinutes ? `${scorecard.timeSpentMinutes} mins` : 'N/A')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Question Breakdown Bar ─────────────────────────────── */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/20 p-3.5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">Question Distribution</span>
            <span className="text-muted font-mono">{totalQuestions} Questions</span>
          </div>

          {/* Stacked bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-3">
            {scorecard.correct > 0 && (
              <div
                style={{ width: `${(scorecard.correct / (totalQuestions || 1)) * 100}%` }}
                className="bg-emerald-500 transition-all"
                title={`Correct: ${scorecard.correct}`}
              />
            )}
            {scorecard.wrong > 0 && (
              <div
                style={{ width: `${(scorecard.wrong / (totalQuestions || 1)) * 100}%` }}
                className="bg-rose-500 transition-all"
                title={`Wrong: ${scorecard.wrong}`}
              />
            )}
            {scorecard.unattempted > 0 && (
              <div
                style={{ width: `${(scorecard.unattempted / (totalQuestions || 1)) * 100}%` }}
                className="bg-slate-500/40 transition-all"
                title={`Unattempted: ${scorecard.unattempted}`}
              />
            )}
          </div>

          <div className="mt-2.5 grid grid-cols-3 text-center text-xs">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <span className="block text-base font-extrabold text-emerald-400">
                {scorecard.correct || 0}
              </span>
              <span className="text-[10px] text-muted">Correct</span>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-2">
              <span className="block text-base font-extrabold text-rose-400">
                {scorecard.wrong || 0}
              </span>
              <span className="text-[10px] text-muted">Wrong</span>
            </div>
            <div className="rounded-lg bg-slate-500/10 p-2">
              <span className="block text-base font-extrabold text-muted">
                {scorecard.unattempted || 0}
              </span>
              <span className="text-[10px] text-muted">Unattempted</span>
            </div>
          </div>
        </div>

        {/* ── Mistakes & Error Analysis ──────────────────────────── */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/20 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-rose-400" /> Mistakes & Error Log ({mistakes.length})
            </span>
            {!addingMistake && (
              <button
                type="button"
                data-export-hide="true"
                onClick={() => setAddingMistake(true)}
                className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-accent hover:border-accent"
              >
                <Plus className="h-3 w-3" /> Log Mistake
              </button>
            )}
          </div>

          {addingMistake && (
            <div data-export-hide="true" className="mb-3 rounded-xl border border-line bg-surface p-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {MISTAKE_TAGS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewMistake((m) => ({ ...m, tag: t.id }))}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors',
                      newMistake.tag === t.id
                        ? `${t.color} font-bold`
                        : 'border-line text-muted hover:text-ink'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newMistake.topic}
                  onChange={(e) => setNewMistake((m) => ({ ...m, topic: e.target.value }))}
                  placeholder="Topic (e.g. Syllogisms)"
                  className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-xs outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={newMistake.questionNo}
                  onChange={(e) => setNewMistake((m) => ({ ...m, questionNo: e.target.value }))}
                  placeholder="Q# (e.g. Q12)"
                  className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-xs outline-none focus:border-accent"
                />
              </div>

              <input
                type="text"
                value={newMistake.note}
                onChange={(e) => setNewMistake((m) => ({ ...m, note: e.target.value }))}
                placeholder="What went wrong & how to avoid next time..."
                className="rounded-lg border border-line bg-surface-2/50 px-2.5 py-1 text-xs outline-none focus:border-accent"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAddingMistake(false)}
                  className="px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMistake}
                  className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {mistakes.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted/70">
              No mistakes logged for this test. Add mistakes to track silly errors and speed traps.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {mistakes.map((m) => {
                const tagInfo = MISTAKE_TAGS.find((t) => t.id === m.tag) || MISTAKE_TAGS[0]
                return (
                  <div
                    key={m.id}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-line/60 bg-surface/70 px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold', tagInfo.color)}>
                        {tagInfo.label}
                      </span>
                      {m.questionNo && (
                        <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted">
                          {m.questionNo}
                        </span>
                      )}
                      {m.topic && (
                        <span className="shrink-0 text-ink font-medium">
                          {m.topic}:
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-muted group-hover:text-ink">
                        {m.note}
                      </span>
                    </div>
                    <button
                      type="button"
                      data-export-hide="true"
                      onClick={() => handleRemoveMistake(m.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-rose-400 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Branded Watermark in exported image / bottom of card */}
        <div className="flex items-center justify-between border-t border-line/40 pt-3.5 pb-6 text-[11px] text-muted select-none">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/20 text-[10px] font-bold text-accent">P</span>
            <span className="font-bold text-ink tracking-wide">PRO TRACK</span>
            <span className="text-muted/60">• Exam Report Card</span>
          </div>
          <span className="text-[10px] text-muted/60 font-mono">Performance Verified</span>
        </div>
      </div>
    </div>
  </Modal>
  )
}
