import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { playSound } from '@/lib/sound'
import { snoozeCheckins } from '@/hooks/useCheckIns'
import { snoozeHabitCue } from '@/hooks/useHabitReminders'
import { CheckinPromptBody } from './CheckinPromptBody'
import { RoutinePromptBody } from './RoutinePromptBody'

/**
 * Screen-center blur overlay for prompts that need an answer — daily check-ins
 * and routine/habit cues. Idle quotes share the same prompt queue for ordering
 * but paint their own visual (ZenOverlay), so this shell only renders the
 * check-in and routine types.
 *
 * Esc or the ✕ dismiss without answering: that runs the prompt's source
 * snooze (so it is never lost silently) then advances the queue. One gentle
 * chime plays on open. Sits above the Dynamic Island (z-[60]). Mounted once in
 * Dashboard.
 */
const BODIES = {
  checkin: CheckinPromptBody,
  routine: RoutinePromptBody,
}

export function CenterPrompt() {
  const { user } = useAuth()
  const activePrompt = useStore((s) => s.activePrompt)
  const resolvePrompt = useStore((s) => s.resolvePrompt)
  const snoozePrompt = useStore((s) => s.snoozePrompt)
  const focusLocked = useStore((s) => s.focusLocked)
  const focusRunning = useStore((s) => s.status === 'running')

  const type = activePrompt?.type
  const Body = type ? BODIES[type] : null
  // Mirror the app-wide rule: never steal the screen during a focus session.
  const open = Boolean(Body) && !focusLocked && !focusRunning

  // Unanswered close → run the type's snooze, then advance the queue.
  const dismiss = useCallback(() => {
    if (!activePrompt || activePrompt.dismissible === false) return
    if (activePrompt.type === 'checkin') {
      snoozeCheckins(activePrompt.snoozeMs ?? undefined)
    } else if (activePrompt.type === 'routine') {
      snoozeHabitCue(user?.uid, activePrompt.payload, activePrompt.snoozeMs ?? undefined)
    }
    snoozePrompt()
  }, [activePrompt, user?.uid, snoozePrompt])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <PromptShell
          key={activePrompt.id}
          prompt={activePrompt}
          Body={Body}
          uid={user?.uid}
          onResolve={resolvePrompt}
          onDismiss={dismiss}
        />
      )}
    </AnimatePresence>,
    document.body,
  )
}

function PromptShell({ prompt, Body, uid, onResolve, onDismiss }) {
  const panelRef = useRef(null)

  useEffect(() => {
    playSound('prompt')
  }, [])

  // Focus the first field on open and keep Tab inside the panel.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return undefined
    const focusables = () =>
      [...panel.querySelectorAll('button, input, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && el.offsetParent !== null)

    const first = focusables()[0]
    first?.focus()

    const onKey = (e) => {
      if (e.key !== 'Tab') return
      const els = focusables()
      if (!els.length) return
      const idx = els.indexOf(document.activeElement)
      if (e.shiftKey && (idx <= 0)) {
        e.preventDefault()
        els[els.length - 1].focus()
      } else if (!e.shiftKey && idx === els.length - 1) {
        e.preventDefault()
        els[0].focus()
      }
    }
    panel.addEventListener('keydown', onKey)
    return () => panel.removeEventListener('keydown', onKey)
  }, [])

  // Esc closes (when dismissible). Capture phase so it beats the global
  // Dashboard Escape handler.
  useEffect(() => {
    if (prompt.dismissible === false) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onDismiss()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [prompt.dismissible, onDismiss])

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xl" />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-line/70 bg-surface/90 p-5 shadow-glass backdrop-blur-2xl"
      >
        {prompt.dismissible !== false && (
          <button
            onClick={onDismiss}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close (snoozes for later)"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {Body && (
          <Body prompt={prompt} uid={uid} onResolve={onResolve} onDismiss={onDismiss} />
        )}

        {prompt.dismissible !== false && (
          <p className="mt-4 text-center text-[10px] uppercase tracking-wider text-muted/70">
            Press Esc or ✕ to close · snoozes until later
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
