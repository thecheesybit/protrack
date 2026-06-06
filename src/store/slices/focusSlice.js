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
    set((s) => ({
      focusMin,
      breakMin,
      secondsLeft: s.status === 'idle' && s.phase === 'focus' ? focusMin * 60 : s.secondsLeft,
    })),

  // Phase 1.1 Actions
  setCustomTimer: (workSec, breakSec) => 
    set({ customTimerSetting: { work: workSec, break: breakSec } }),
  
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
      startedAt: Date.now(),
    })),

  bumpCompleted: () => set((s) => ({ justCompleted: s.justCompleted + 1 })),

  endToIdle: () =>
    set((s) => ({ 
      status: 'idle', 
      phase: 'focus', 
      secondsLeft: s.customTimerSetting.work, 
      startedAt: null, 
      focusLocked: false 
    })),
})
