import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { playChime, playEventSound, MultiTrackMixer } from '@/lib/audioEngine'
import { notify, ensureNotificationPermission } from '@/lib/notify'
import { logFocusSession } from '@/services/focusService'
import { addLedgerEntry } from '@/services/ledgerService'
import { updateTodo } from '@/services/todoService'
import { toggleSlotCompletion } from '@/services/timetableService'
import { ymd } from '@/lib/dates'

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
  const pipActive = useStore((s) => s.pipActive)
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
  // Skipped entirely while floating in PiP — the PiP window owns its own tiny
  // bounds, so forcing fullscreen here (e.g. when the user hits resume inside
  // the mini window) would blow the floating widget up to full screen.
  useEffect(() => {
    if (pipActive) return
    if (status === 'running' && phase === 'focus') {
      window.protrack?.window?.setFullScreen?.(true)
    } else if (status === 'idle' || phase === 'break') {
      window.protrack?.window?.setFullScreen?.(false)
    }
  }, [status, phase, pipActive])

  // ── Always-on-top: engage when locked, disengage on unlock ──
  useEffect(() => {
    if (focusLocked) {
      window.protrack?.window?.setAlwaysOnTop?.(true)
      playEventSound('lock-initiated')
    } else {
      window.protrack?.window?.setAlwaysOnTop?.(false)
    }
  }, [focusLocked])

  const complete = useCallback(async (overrideElapsedSec = null) => {
    if (completingRef.current) return
    completingRef.current = true
    const st = useStore.getState()
    st.tick() // visually land on 0
    if (!st.muted) playChime()

    if (st.phase === 'focus') {
      const elapsedSec = overrideElapsedSec != null
        ? overrideElapsedSec
        : Math.max(0, (st.phaseTotalSec || 0) - (st.secondsLeft || 0))
      const durationMin = Math.max(1, Math.round(elapsedSec / 60))
      const plantType = durationMin < 10 ? 'flower' : durationMin <= 15 ? 'shrub' : 'tree'
      const plantLabel = plantType === 'flower' ? 'flower' : plantType === 'shrub' ? 'shrub' : 'tree'
      const plantEmoji = plantType === 'flower' ? '🌸' : plantType === 'shrub' ? '🌿' : '🌲'

      st.bumpCompleted()
      notify(`Focus complete! ${plantEmoji}`, `Congratulations! You completed your ${durationMin}-minute session.`, { category: 'focus' })
      st.pushIsland({
        kind: 'success',
        title: '🎉 Focus session complete!',
        detail: `Planted a ${plantLabel} on today's calendar! (${durationMin} min)`,
        duration: 5000,
      })

      // Congratulate and trigger celebration modal
      useStore.setState({
        congratulations: {
          durationMin,
          plantType,
          label: st.session?.label || 'Deep Focus',
          timestamp: Date.now(),
        },
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
          slotId: st.session?.slotId || null,
          targetDate: st.session?.targetDate || null,
          label: st.session?.label || 'Deep focus',
          color: st.session?.color || null,
          durationMin,
          plantType,
          startedAt: st.startedAt ? new Date(st.startedAt) : new Date(),
          hourOfDay: (st.startedAt ? new Date(st.startedAt) : new Date()).getHours(),
        })
        await addLedgerEntry(uid, {
          kind: 'focus',
          title: `${durationMin}-minute focus block`,
          detail: st.session?.label || 'Deep focus',
          modeId: resolvedModeId,
        })
        if (st.session?.slotId) {
          const targetDate = st.session.targetDate || ymd()
          toggleSlotCompletion(uid, resolvedModeId, st.session.slotId, targetDate, true).catch((err) =>
            console.error('[focus] slot mark-done failed', err),
          )
        }
        if (st.session?.todoId) {
          updateTodo(uid, st.session.todoId, { done: true }).catch((err) =>
            console.error('[focus] todo mark-done failed', err),
          )
        }
      } catch (err) {
        console.error('[focus] failed to log session', err)
      }

      // Automatically end session and return to dashboard with newly planted foliage
      st.endToIdle()
      window.protrack?.window?.setFullScreen?.(false)
    } else {
      notify('Break over', 'Ready for another deep focus session?', { category: 'focus' })
      st.pushIsland({
        kind: 'focus',
        title: 'Break over',
        detail: 'Ready for another deep session?',
        duration: 4500,
      })
      st.endToIdle()
    }
    completingRef.current = false
  }, [user])

  // Expose completeFocus on store so UI can trigger completion & planting
  useEffect(() => {
    useStore.setState({ completeFocus: complete })
    return () => {
      useStore.setState({ completeFocus: null })
    }
  }, [complete])

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
