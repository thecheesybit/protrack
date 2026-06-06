import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { playChime, AmbientPlayer } from '@/lib/audioEngine'
import { notify, ensureNotificationPermission } from '@/lib/notify'
import { logFocusSession } from '@/services/focusService'

/**
 * Mounted once (in Dashboard). Owns the 1s tick interval, the ambient sound
 * lifecycle, and the on-complete side-effects (chime, notification, persist,
 * grow tree). Keeping this outside the slice keeps state pure and testable.
 */
export function useFocusEngine() {
  const { user } = useAuth()
  const status = useStore((s) => s.status)
  const ambient = useStore((s) => s.ambient)
  const intervalRef = useRef(null)
  const ambientRef = useRef(null)
  const completingRef = useRef(false)

  if (!ambientRef.current) ambientRef.current = new AmbientPlayer()

  useEffect(() => {
    ensureNotificationPermission()
    const player = ambientRef.current
    return () => player.stop()
  }, [])

  const complete = async () => {
    if (completingRef.current) return
    completingRef.current = true
    const st = useStore.getState()
    st.tick() // visually land on 0
    playChime()

    if (st.phase === 'focus') {
      const durationMin = st.focusMin
      st.bumpCompleted()
      notify('Focus complete 🌳', 'Great work! Time for a short break.')
      toast.success('Session complete — a tree grew 🌳')
      try {
        await logFocusSession(user.uid, {
          modeId: st.session?.modeId || useStore.getState().activeModeId,
          subjectId: st.session?.subjectId || null,
          durationMin,
          startedAt: st.startedAt ? new Date(st.startedAt) : new Date(),
          hourOfDay: (st.startedAt ? new Date(st.startedAt) : new Date()).getHours(),
        })
      } catch (err) {
        console.error('[focus] failed to log session', err)
      }
      st.startBreak()
    } else {
      notify('Break over', 'Ready for another deep focus session?')
      toast('Break over — ready to focus?')
      st.endToIdle()
    }
    completingRef.current = false
  }

  // Tick loop — restarts whenever status flips to running.
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (status === 'running') {
      intervalRef.current = setInterval(() => {
        const st = useStore.getState()
        if (st.secondsLeft <= 1) complete()
        else st.tick()
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Ambient soundscape lifecycle.
  useEffect(() => {
    const player = ambientRef.current
    if (status === 'running' && ambient !== 'none') player.start(ambient)
    else player.stop()
  }, [status, ambient])
}
