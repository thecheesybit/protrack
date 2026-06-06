import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { playChime, AmbientPlayer } from '@/lib/audioEngine'
import { notify, ensureNotificationPermission } from '@/lib/notify'
import { logFocusSession } from '@/services/focusService'
import { addLedgerEntry } from '@/services/ledgerService'

/**
 * Mounted once (in Dashboard). Owns the 1s tick interval, the ambient sound
 * lifecycle, and the on-complete side-effects (chime, notification, persist,
 * grow tree). Keeping this outside the slice keeps state pure and testable.
 */
export function useFocusEngine() {
  const { user } = useAuth()
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const ambient = useStore((s) => s.ambient)
  const muted = useStore((s) => s.muted)
  const intervalRef = useRef(null)
  const ambientRef = useRef(null)
  const completingRef = useRef(false)

  if (!ambientRef.current) ambientRef.current = new AmbientPlayer()

  useEffect(() => {
    ensureNotificationPermission()
    const player = ambientRef.current
    return () => player.stop()
  }, [])

  // Control full-screen mode for Deep Focus sessions
  useEffect(() => {
    if (status === 'running' && phase === 'focus') {
      window.protrack?.window?.setFullScreen?.(true)
    } else if (status === 'idle' || phase === 'break') {
      window.protrack?.window?.setFullScreen?.(false)
    }
  }, [status, phase])

  const complete = async () => {
    if (completingRef.current) return
    completingRef.current = true
    const st = useStore.getState()
    st.tick() // visually land on 0
    if (!st.muted) playChime()

    if (st.phase === 'focus') {
      const durationMin = st.focusMin
      st.bumpCompleted()
      notify('Focus complete', 'Great work. Time for a short break.')
      st.pushIsland({
        kind: 'success',
        title: 'Focus session complete',
        detail: 'A tree grew. Time for a short break.',
        duration: 5000,
      })
      try {
        const uid = user?.uid
        if (!uid) throw new Error('not authenticated')
        await logFocusSession(uid, {
          modeId: st.session?.modeId || useStore.getState().activeModeId,
          subjectId: st.session?.subjectId || null,
          durationMin,
          startedAt: st.startedAt ? new Date(st.startedAt) : new Date(),
          hourOfDay: (st.startedAt ? new Date(st.startedAt) : new Date()).getHours(),
        })
        await addLedgerEntry(uid, {
          kind: 'focus',
          title: `${durationMin}-minute focus block`,
          detail: st.session?.label || 'Deep focus',
          modeId: st.session?.modeId || useStore.getState().activeModeId,
        })
      } catch (err) {
        console.error('[focus] failed to log session', err)
      }
      st.startBreak()
    } else {
      notify('Break over', 'Ready for another deep focus session?')
      st.pushIsland({
        kind: 'focus',
        title: 'Break over',
        detail: 'Ready for another deep focus session?',
        duration: 4500,
      })
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

  // Ambient soundscape lifecycle (silenced while muted).
  useEffect(() => {
    const player = ambientRef.current
    if (status === 'running' && ambient !== 'none' && !muted) player.start(ambient)
    else player.stop()
  }, [status, ambient, muted])

  // Listen for Electron global hotkey Focus Toggle events.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.protrack?.onFocusToggle) {
      const unsub = window.protrack.onFocusToggle(() => {
        const st = useStore.getState()
        if (st.status === 'running') {
          st.pause()
        } else if (st.status === 'paused') {
          st.resume()
        } else if (st.status === 'idle') {
          st.startFocus()
        }
      })
      return unsub
    }
  }, [])

  // Listen for Electron global hotkey Mute events.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.protrack?.onMute) {
      const unsub = window.protrack.onMute(() => {
        const st = useStore.getState()
        st.toggleMute()
      })
      return unsub
    }
  }, [])
}
