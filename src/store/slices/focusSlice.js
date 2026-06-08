/**
 * Pomodoro / Deep Focus timer state. The orchestration (interval ticking,
 * completion side-effects, sound) lives in useFocusEngine — this slice only
 * holds state and pure transitions.
 */
const DEFAULT_FOCUS = 25
const DEFAULT_BREAK = 5

export const createFocusSlice = (set, get) => ({
  status: 'idle', // 'idle' | 'running' | 'paused'
  phase: 'focus', // 'focus' | 'break'
  focusMin: DEFAULT_FOCUS,
  breakMin: DEFAULT_BREAK,
  secondsLeft: DEFAULT_FOCUS * 60,
  // Total seconds for the CURRENT phase — drives the progress ring. Tracked
  // separately from customTimerSetting so mid-session +/- adjustments keep the
  // ring proportional without mutating the user's default timer.
  phaseTotalSec: DEFAULT_FOCUS * 60,
  session: null, // { label, color, subjectId, modeId } | null
  startedAt: null,
  
  // Phase 1.1: New State payloads
  focusLocked: false,
  customTimerSetting: { work: DEFAULT_FOCUS * 60, break: DEFAULT_BREAK * 60 },
  volume: 0.5,
  audioTracks: { ambient1: 'off', ambient2: 'off', ytTrack: '' },
  muted: false,
  justCompleted: 0,

  setDurations: (focusMin, breakMin) =>
    set((s) => {
      const idleFocus = s.status === 'idle' && s.phase === 'focus'
      return {
        focusMin,
        breakMin,
        secondsLeft: idleFocus ? focusMin * 60 : s.secondsLeft,
        phaseTotalSec: idleFocus ? focusMin * 60 : s.phaseTotalSec,
      }
    }),

  // Phase 1.1 Actions
  setCustomTimer: (workSec, breakSec) =>
    set((s) => ({
      customTimerSetting: { work: workSec, break: breakSec },
      // Reflect the new work length immediately when idle on the focus phase.
      secondsLeft: s.status === 'idle' && s.phase === 'focus' ? workSec : s.secondsLeft,
      phaseTotalSec: s.status === 'idle' && s.phase === 'focus' ? workSec : s.phaseTotalSec,
    })),

  /**
   * Add or remove time from the current phase mid-session. Positive grows both
   * the remaining time and the phase total (ring stays proportional); negative
   * only trims remaining time (ring advances). Clamped to a 1-minute floor.
   */
  adjustSeconds: (deltaSec) =>
    set((s) => {
      const next = Math.max(60, s.secondsLeft + deltaSec)
      return {
        secondsLeft: next,
        phaseTotalSec: Math.max(s.phaseTotalSec, next),
      }
    }),
  
  adjustTrackVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  
  toggleConcurrentTrack: (trackKey, trackValue) => 
    set((s) => ({ audioTracks: { ...s.audioTracks, [trackKey]: trackValue } })),
  
  setFocusLock: (isLocked) => set({ focusLocked: isLocked }),

  setMuted: (muted) => set({ muted }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),

  startFocus: (session = null) =>
    set((s) => {
      // Use customTimerSetting if defined and we are just starting
      const startingSeconds = s.phase === 'focus' && s.status === 'paused' 
        ? s.secondsLeft 
        : s.customTimerSetting.work;
        
      return {
        status: 'running',
        phase: 'focus',
        session: session || s.session,
        secondsLeft: startingSeconds,
        phaseTotalSec: startingSeconds,
        startedAt: Date.now(),
        focusLocked: true,
      };
    }),

  pause: () => set({ status: 'paused' }),
  resume: () => set({ status: 'running' }),

  reset: () =>
    set((s) => ({
      status: 'idle',
      phase: 'focus',
      secondsLeft: s.customTimerSetting.work,
      phaseTotalSec: s.customTimerSetting.work,
      startedAt: null,
      focusLocked: false,
    })),

  tick: () =>
    set((s) => ({ secondsLeft: Math.max(0, s.secondsLeft - 1) })),

  startBreak: () =>
    set((s) => ({
      status: 'running',
      phase: 'break',
      secondsLeft: s.customTimerSetting.break,
      phaseTotalSec: s.customTimerSetting.break,
      startedAt: Date.now(),
    })),

  bumpCompleted: () => set((s) => ({ justCompleted: s.justCompleted + 1 })),

  endToIdle: () =>
    set((s) => ({
      status: 'idle',
      phase: 'focus',
      secondsLeft: s.customTimerSetting.work,
      phaseTotalSec: s.customTimerSetting.work,
      startedAt: null,
      focusLocked: false
    })),
})
