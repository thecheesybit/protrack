import { useState } from 'react'
import { Play, Trash2, Timer } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { playPop } from '@/lib/sound'
import { logFailedFocusSession } from '@/services/focusService'
import { clearFocusSnapshot } from '@/lib/focusPersistence'

function mmss(sec) {
  const s = Math.max(0, Math.round(sec || 0))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Boot-time recovery prompt for a Deep Focus session interrupted by a crash,
 * force-close, or auto-update (see useFocusRecovery). Resume restores the
 * exact paused state from the snapshot; Discard logs it as an abandoned
 * session, matching the manual "give up" path in FocusWidget.
 */
export function FocusResumePromptBody({ prompt, onResolve }) {
  const { user } = useAuth()
  const snapshot = prompt.payload || {}
  const resumeFocusSession = useStore((s) => s.resumeFocusSession)
  const discardResumableSession = useStore((s) => s.discardResumableSession)
  const [busy, setBusy] = useState(false)

  const label = snapshot.session?.label || 'Deep Focus'
  const elapsedSec = Math.max(0, (snapshot.phaseTotalSec || 0) - (snapshot.secondsLeft || 0))
  const totalMin = Math.max(1, Math.round((snapshot.phaseTotalSec || 0) / 60))

  const handleResume = () => {
    playPop()
    resumeFocusSession()
    onResolve()
  }

  const handleDiscard = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (user?.uid) {
        await logFailedFocusSession(user.uid, {
          modeId: snapshot.session?.modeId || null,
          subjectId: snapshot.session?.subjectId || null,
          startedAt: snapshot.startedAt ? new Date(snapshot.startedAt) : new Date(),
        })
      }
    } catch (err) {
      console.error('[focus-recovery] failed to log discarded session', err)
    }
    clearFocusSnapshot()
    discardResumableSession()
    setBusy(false)
    onResolve()
  }

  return (
    <div className="flex flex-col gap-3 pr-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shadow-sm">
          <Timer className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Interrupted session
          </span>
          <h4 className="text-base font-bold text-ink">{label}</h4>
          <p className="text-[11px] leading-relaxed text-muted">
            {mmss(elapsedSec)} of {totalMin}m was in progress when the app closed. Resume where
            you left off, or discard it.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line/40 pt-3">
        <button
          onClick={handleResume}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Play className="h-4 w-4" />
          Resume session
        </button>
        <button
          onClick={handleDiscard}
          disabled={busy}
          className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Discard
        </button>
      </div>
    </div>
  )
}
