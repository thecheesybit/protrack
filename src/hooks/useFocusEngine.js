import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { playChime, playEventSound, MultiTrackMixer } from '@/lib/audioEngine'
import { notify, ensureNotificationPermission } from '@/lib/notify'
import { logFocusSession } from '@/services/focusService'
import { addLedgerEntry } from '@/services/ledgerService'

/**
 * Mounted once (in Dashboard). Owns the 1s tick interval, the ambient sound
 * lifecycle, and the on-complete side-effects (chime, notification, persist,
 * grow tree). Keeping this outside the slice keeps state pure and testable.
 *
 * Also manages the "focus lock" — when a session starts, fullscreen and
 * alwaysOnTop are engaged, and the Dashboard shows a lock-screen overlay.
 * Fullscreen is only active during the focus phase; during break the window
 * exits fullscreen but focusLocked stays true (the lock-screen stays on).
 */
export function useFocusEngine() {
  const { user } = useAuth()
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const audioTracks = useStore((s) => s.audioTracks)
  const muted = useStore((s) => s.muted)
  const volume = useStore((s) => s.volume)
  const focusLocked = useStore((s) => s.focusLocked)
  const intervalRef = useRef(null)
  const mixerRef = useRef(null)
  const completingRef = useRef(false)

  if (!mixerRef.current) mixerRef.current = new MultiTrackMixer()

  useEffect(() => {
    ensureNotificationPermission()
    const mixer = mixerRef.current
    return () => mixer.stopAll()
  }, [])

  // ── Fullscreen: only during focus phase, exit on break/idle ──
  useEffect(() => {
    if (status === 'running' && phase === 'focus') {
      window.protrack?.window?.setFullScreen?.(true)
    } else if (status === 'idle' || phase === 'break') {
      window.protrack?.window?.setFullScreen?.(false)
    }
  }, [status, phase])

  // ── Always-on-top: engage when locked, disengage on unlock ──
  useEffect(() => {
    if (focusLocked) {
      window.protrack?.window?.setAlwaysOnTop?.(true)
      playEventSound('lock-initiated')
    } else {
      window.protrack?.window?.setAlwaysOnTop?.(false)
    }
  }, [focusLocked])

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
        const rawModeId = st.session?.modeId || useStore.getState().activeModeId
        const resolvedModeId = rawModeId === 'all'
          ? (useStore.getState().modes[0]?.id || null)
          : rawModeId
        await logFocusSession(uid, {
          modeId: resolvedModeId,
          subjectId: st.session?.subjectId || null,
          durationMin,
          startedAt: st.startedAt ? new Date(st.startedAt) : new Date(),
          hourOfDay: (st.startedAt ? new Date(st.startedAt) : new Date()).getHours(),
        })
        await addLedgerEntry(uid, {
          kind: 'focus',
          title: `${durationMin}-minute focus block`,
          detail: st.session?.label || 'Deep focus',
          modeId: resolvedModeId,
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
    const mixer = mixerRef.current
    if (status === 'running' && !muted) {
      if (audioTracks.ambient1 && audioTracks.ambient1 !== 'off') {
        mixer.startTrack('ambient1', audioTracks.ambient1)
      } else {
        mixer.stopTrack('ambient1')
      }
      
      if (audioTracks.ambient2 && audioTracks.ambient2 !== 'off') {
        mixer.startTrack('ambient2', audioTracks.ambient2)
      } else {
        mixer.stopTrack('ambient2')
      }
    } else {
      mixer.stopAll()
    }
  }, [status, audioTracks, muted])

  // Sync volume to the ambient player whenever it changes.
  useEffect(() => {
    mixerRef.current?.setGain?.(volume)
  }, [volume])

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
