import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sunrise, Sun, Sunset, X, ListPlus, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { saveCheckinAnswer } from '@/services/checkinService'
import { addTodo } from '@/services/todoService'
import { snoozeCheckins } from '@/hooks/useCheckIns'
import { energyTrend, checkinInsight } from '@/lib/checkin'
import { ymd } from '@/lib/dates'
import { cn } from '@/utils/cn'

const SLOT_META = {
  morning: { icon: Sunrise, label: 'Morning check-in' },
  midday: { icon: Sun, label: 'Midday check-in' },
  evening: { icon: Sunset, label: 'Evening check-in' },
}

/**
 * The daily check-in card — a quiet glass panel in the bottom-left corner.
 * One short question, answered in a tap or a line; dismissing snoozes all
 * slots for 90 minutes. Renders nothing unless useCheckIns offered a prompt.
 */
export function CheckInCard() {
  const prompt = useStore((s) => s.checkinPrompt)
  const focusLocked = useStore((s) => s.focusLocked)

  return (
    <AnimatePresence>
      {prompt && !focusLocked && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed bottom-6 left-6 z-30 w-[21rem] rounded-2xl border border-line bg-surface/90 p-4 shadow-glass backdrop-blur-md"
        >
          {/* key resets answer state whenever a different question arrives */}
          <CheckInBody key={prompt.question.id} prompt={prompt} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CheckInBody({ prompt }) {
  const { user } = useAuth()
  const checkins = useStore((s) => s.checkins)
  const activeModeId = useStore((s) => s.activeModeId)
  const clearCheckinPrompt = useStore((s) => s.clearCheckinPrompt)
  const pushIsland = useStore((s) => s.pushIsland)

  const { slot, question } = prompt
  const { icon: SlotIcon, label } = SLOT_META[slot] || SLOT_META.morning

  const [text, setText] = useState('')
  const [scale, setScale] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const dismiss = () => {
    snoozeCheckins()
    clearCheckinPrompt()
  }

  // scaleValue lets a chip tap save immediately — React state (`scale`) won't
  // have flushed yet inside the same click handler.
  const save = async ({ alsoTodo = false, scaleValue = null } = {}) => {
    const value = question.type === 'intent' ? text.trim() : scaleValue ?? scale
    if (!user || !value || saving) return
    setSaving(true)
    try {
      await saveCheckinAnswer(user.uid, ymd(), slot, {
        qid: question.id,
        type: question.type,
        value,
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      if (alsoTodo) await addTodo(user.uid, { text: value, modeId: activeModeId })
      clearCheckinPrompt()
      pushIsland({
        kind: 'success',
        title: 'Checked in',
        detail: alsoTodo ? 'Added to your to-dos.' : 'Noted.',
        duration: 3200,
      })
      // Quiet adaptation: a low rating earns one gentle suggestion, not a lecture.
      if (question.type === 'scale' && value <= 2) {
        pushIsland({
          kind: 'info',
          title: slot === 'evening' ? 'Tomorrow is a fresh start' : 'Low energy noted',
          detail:
            slot === 'evening'
              ? 'Consider an easier first block tomorrow.'
              : 'Try a shorter focus block or a 5-minute reset.',
          duration: 6000,
        })
      }
    } catch (err) {
      console.error('[checkin] save failed', err)
      pushIsland({
        kind: 'info',
        title: 'Check-in not saved',
        detail: 'No connection — we will ask again soon.',
        duration: 4500,
      })
      snoozeCheckins(15 * 60 * 1000)
      clearCheckinPrompt()
    } finally {
      setSaving(false)
    }
  }

  const trend = energyTrend(checkins, 7)
  const hasTrend = trend.some((d) => d.value !== null)
  const insight = checkinInsight(checkins)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-accent">
          <SlotIcon className="h-3.5 w-3.5" />
          {label}
        </span>
        <button
          onClick={dismiss}
          className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          title="Not now (snoozes for 90 minutes)"
          aria-label="Dismiss check-in"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-sm font-semibold leading-snug text-ink">{question.text}</p>

      {question.type === 'intent' ? (
        <div className="flex flex-col gap-2">
          {/* No autoFocus — the card must never steal the keyboard from
              whatever the user is typing when it slides in. */}
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            maxLength={140}
            placeholder="One line is plenty…"
            className="w-full rounded-xl border border-line bg-surface-2/40 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => save()}
              disabled={!text.trim() || saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button
              onClick={() => save({ alsoTodo: true })}
              disabled={!text.trim() || saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2/40 px-3 py-2 text-xs font-bold text-ink transition-colors hover:border-line-2 disabled:opacity-40"
            >
              <ListPlus className="h-3.5 w-3.5" /> Make it a to-do
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => {
                  setScale(v)
                  // Questions without a note save on tap — one-touch check-in.
                  if (!question.note) save({ scaleValue: v })
                }}
                className={cn(
                  'flex-1 rounded-xl border py-2 text-sm font-bold transition-all',
                  scale === v
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-surface-2/40 text-ink hover:border-line-2',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-medium text-muted">
            <span>{question.low}</span>
            <span>{question.high}</span>
          </div>
          {question.note && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scale && save()}
              maxLength={200}
              placeholder="Anything worth remembering? (optional)"
              className="w-full rounded-xl border border-line bg-surface-2/40 px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          )}
          <button
            onClick={() => save()}
            disabled={!scale || saving}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white transition-opacity disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Done
          </button>
        </div>
      )}

      {hasTrend && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-2.5">
          <div className="flex items-end justify-between gap-1">
            {trend.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'w-full max-w-[14px] rounded-sm',
                    d.value !== null ? 'bg-accent/70' : 'bg-line',
                  )}
                  style={{ height: d.value !== null ? 4 + d.value * 3 : 3 }}
                  title={d.value !== null ? `${d.label}: ${d.value.toFixed(1)}/5` : d.label}
                />
                <span className="text-[8px] font-medium uppercase text-muted">
                  {d.label.slice(0, 1)}
                </span>
              </div>
            ))}
          </div>
          {insight && <p className="text-[10px] leading-snug text-muted">{insight}</p>}
        </div>
      )}
    </div>
  )
}
