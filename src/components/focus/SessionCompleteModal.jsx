import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Check, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { SpriteFoliage, formatFloraBreakdown } from '@/components/focus/ForestSprites'
import { playFocusChime } from '@/lib/audioFX'
import { isMappingOverride } from '@/lib/topicMapping'
import {
  completeTaskAndRecomputeProgress,
  completeTodoAndRecomputeProgress,
  setMappingNeedsReview,
} from '@/services/subjectService'
import { updateTodo } from '@/services/todoService'
import { addLedgerEntry } from '@/services/ledgerService'

const candidateKey = (c) => (c ? `${c.kind}:${c.id}` : '')

/** One flora type + count badge, used to summarize a (possibly multi-plant) session at a glance. */
function FloraBadge({ type, count, height }) {
  if (!count) return null
  return (
    <div className="relative flex h-24 w-24 items-end justify-center overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/10 pb-2 shadow-inner">
      <SpriteFoliage type={type} height={height} />
      {count > 1 && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-slate-950">
          ×{count}
        </span>
      )}
    </div>
  )
}

export function SessionCompleteModal() {
  const congratulations = useStore((s) => s.congratulations)
  const clearCongratulations = useStore((s) => s.clearCongratulations)
  const { user } = useAuth()

  const [markDone, setMarkDone] = useState(true)
  const [editing, setEditing] = useState(false)
  const [chosenKey, setChosenKey] = useState(null)

  useEffect(() => {
    if (congratulations) {
      try {
        playFocusChime()
      } catch { /* noop */ }
      setMarkDone(true)
      setEditing(false)
      setChosenKey(null)
    }
  }, [congratulations])

  const durationMin = congratulations?.durationMin ?? 25
  const counts = congratulations?.counts ?? {
    trees: 0,
    shrubs: 0,
    flowers: congratulations ? 1 : 0,
  }
  const label = congratulations?.label ?? 'Deep Focus'
  const modeId = congratulations?.modeId ?? null
  const subjectId = congratulations?.subjectId ?? null
  const topicSuggestion = congratulations?.topicSuggestion ?? null
  const topicCandidates = useMemo(() => congratulations?.topicCandidates ?? [], [congratulations])

  const target = useMemo(() => {
    if (!chosenKey) return topicSuggestion
    return topicCandidates.find((c) => candidateKey(c) === chosenKey) || topicSuggestion
  }, [chosenKey, topicSuggestion, topicCandidates])

  const handleDismiss = async () => {
    if (markDone && target && user?.uid) {
      try {
        if (target.kind === 'task') {
          const targetSubjectId = target.subjectId || subjectId
          await completeTaskAndRecomputeProgress(user.uid, modeId, targetSubjectId, target.id)
        } else if (target.kind === 'todo') {
          if (target.subjectId) {
            await completeTodoAndRecomputeProgress(user.uid, modeId, target.subjectId, target.id)
          } else {
            await updateTodo(user.uid, target.id, { done: true })
          }
        }
        await addLedgerEntry(user.uid, {
          kind: 'task',
          title: `Completed: ${target.title || 'topic'}`,
          detail: `Mapped from a ${durationMin}-minute focus session`,
          modeId,
        })
        if (subjectId && isMappingOverride(topicSuggestion, target)) {
          setMappingNeedsReview(user.uid, modeId, subjectId, true).catch(() => {})
        }
      } catch (err) {
        console.error('[focus] topic completion failed', err)
      }
    }
    clearCongratulations()
  }

  const topicLabel = target?.kind === 'task' ? 'topic' : 'to-do'

  return (
    <AnimatePresence>
      {congratulations && (
        <motion.div
          key="session-complete-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        >
          <motion.div
            key="session-complete-modal"
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-500/30 bg-slate-950 p-6 text-center shadow-2xl"
          >
            {/* Decorative ambient glow */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <Trophy className="h-3.5 w-3.5" />
              <span>Session Accomplished!</span>
            </div>

            {/* Growing Flora Centerpiece — one badge per plant type, so a long
                multi-tree session shows all of what it grew at a glance. */}
            <div className="my-5 flex flex-col items-center justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                className="flex items-end justify-center gap-2"
              >
                <FloraBadge type="tree" count={counts.trees} height={74} />
                <FloraBadge type="shrub" count={counts.shrubs} height={56} />
                <FloraBadge type="flower" count={counts.flowers} height={46} />
              </motion.div>
              <span className="mt-3 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Grew {formatFloraBreakdown(counts)} on today&apos;s calendar
              </span>
            </div>

            {/* Heading and details */}
            <h2 className="text-xl font-bold text-white">Congratulations! 🎉</h2>
            <p className="mt-1 text-xs text-muted">
              You completed <strong className="text-white">{durationMin} minutes</strong> of {label.toLowerCase()}. Your focus forest is growing!
            </p>

            {/* Smart session -> topic mapping confirm/edit (Section 3) */}
            {topicSuggestion && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={markDone}
                    onChange={(e) => setMarkDone(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-500"
                  />
                  <span className="flex-1 text-xs leading-snug text-white/80">
                    This session was mapped to {topicLabel}{' '}
                    <strong className="text-white">{target?.title || '(untitled)'}</strong> — mark it complete?
                  </span>
                </label>

                {!editing ? (
                  topicCandidates.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-accent hover:underline"
                    >
                      <Pencil className="h-3 w-3" /> Not quite right? Edit
                    </button>
                  )
                ) : (
                  <select
                    autoFocus
                    value={candidateKey(target)}
                    onChange={(e) => setChosenKey(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-accent"
                  >
                    {topicCandidates.map((c) => (
                      <option key={candidateKey(c)} value={candidateKey(c)}>
                        {c.title || '(untitled)'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Action button */}
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-95"
              >
                <Check className="h-4 w-4" />
                <span>Great Job! Continue</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
