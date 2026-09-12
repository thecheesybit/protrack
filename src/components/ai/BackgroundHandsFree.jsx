import { useEffect, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { useTimetable } from '@/hooks/useTimetable'
import { useHabits, useTodos } from '@/hooks/useWellness'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import { getAlarms } from '@/services/alarmService'
import toast from 'react-hot-toast'

const DEFAULT_WAKE = 'hey track'

/**
 * Always-mounted ambient voice loop. Two jobs:
 *  1. When the wake word is enabled in Settings, keep a low-key listener alive so
 *     "Hey Track, …" promotes the app into a full conversation (like Alexa).
 *  2. Whatever way a session starts (wake word OR the double-click AI button that
 *     flips `handsFreeActive`), run the listen→think→act→speak loop.
 *
 * All the machinery lives in useVoiceAgent; this component only wires the store
 * (as the controlled active/status pair) to the live workspace snapshot. It is
 * suppressed while the AI panel is open (the in-panel Voice tab drives the mic
 * then) or during a locked focus session.
 */
export function BackgroundHandsFree() {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const modes = useStore((s) => s.modes)
  const stats = useStore((s) => s.stats)
  const settings = useStore((s) => s.settings)

  const { subjects } = useSubjects(activeModeId)
  const { slots } = useTimetable(activeModeId)
  const habits = useHabits()
  const todos = useTodos()

  const aiOpen = useStore((s) => s.aiOpen)
  const focusLocked = useStore((s) => s.focusLocked)
  const focusStatus = useStore((s) => s.status)
  const focusPhase = useStore((s) => s.phase)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const focusSession = useStore((s) => s.session)

  const handsFreeActive = useStore((s) => s.handsFreeActive)
  const setHandsFreeActive = useStore((s) => s.setHandsFreeActive)
  const handsFreeStatus = useStore((s) => s.handsFreeStatus)
  const setHandsFreeStatus = useStore((s) => s.setHandsFreeStatus)
  const setHandsFreeFeedback = useStore((s) => s.setHandsFreeFeedback)

  const activeMode = modes.find((m) => m.id === activeModeId)
  const wakeEnabled = settings?.wakeWordEnabled === true
  const wakePhrase = (settings?.wakeWord || DEFAULT_WAKE).toLowerCase()
  const turnLimit = settings?.handsFreeTurnLimit || 8

  const snapshot = useMemo(
    () => ({
      uid: user?.uid,
      modeId: activeModeId,
      modeName: activeMode?.name,
      modes,
      subjects,
      slots,
      habits,
      todos,
      alarms: getAlarms(),
      stats,
      focus: { status: focusStatus, phase: focusPhase, secondsLeft, session: focusSession },
    }),
    [
      user?.uid, activeModeId, activeMode?.name, modes, subjects, slots, habits,
      todos, stats, focusStatus, focusPhase, secondsLeft, focusSession,
    ],
  )

  // Keep status coherent with the store-backed active flag.
  useEffect(() => {
    if (handsFreeActive && handsFreeStatus === 'idle') setHandsFreeStatus('listening')
    if (!handsFreeActive && handsFreeStatus !== 'idle') setHandsFreeStatus('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFreeActive])

  const { speechError } = useVoiceAgent({
    active: handsFreeActive,
    setActive: setHandsFreeActive,
    status: handsFreeStatus,
    setStatus: setHandsFreeStatus,
    snapshot,
    wakeWord: wakeEnabled ? wakePhrase : '',
    voiceEnabled: true,
    suppressed: aiOpen || focusLocked,
    turnLimit,
    onFeedback: (fb) => setHandsFreeFeedback(fb),
    onLimit: (reason) => {
      if (reason === 'idle') toast('Hands-free paused (inactivity).', { icon: '⏳' })
      else if (reason === 'turn-limit')
        toast(`Hands-free paused (${turnLimit}-turn limit) to save tokens.`, { icon: '🛑' })
      else if (reason.startsWith('error:'))
        toast.error('Voice error: ' + reason.slice(6))
      setHandsFreeFeedback(null)
    },
  })

  useEffect(() => {
    if (handsFreeActive && speechError) toast.error('Voice loop error: ' + speechError)
  }, [speechError, handsFreeActive])

  return null
}
