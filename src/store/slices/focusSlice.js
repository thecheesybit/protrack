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
  ambient: 'none', // 'none' | 'rain' | 'waves' | 'wind' | 'whitenoise' | 'cafe' | 'forest' | 'binaural'
  muted: false, // global mute for chime + ambient (toggled by hotkey)
  volume: 0.5, // 0.0–1.0 master volume for ambient + background audio
  justCompleted: 0, // bumps to trigger the tree-grow animation
  focusLocked: false, // true = entire UI is locked out during session

  setDurations: (focusMin, breakMin) =>
    set((s) => ({
      focusMin,
      breakMin,
      secondsLeft: s.status === 'idle' && s.phase === 'focus' ? focusMin * 60 : s.secondsLeft,
    })),

  setAmbient: (ambient) => set({ ambient }),

  setMuted: (muted) => set({ muted }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  startFocus: (session = null) =>
    set((s) => ({
      status: 'running',
      phase: 'focus',
      session: session || s.session,
      secondsLeft: s.phase === 'focus' && s.status === 'paused' ? s.secondsLeft : s.focusMin * 60,
      startedAt: Date.now(),
      focusLocked: true,
    })),

  pause: () => set({ status: 'paused' }),
  resume: () => set({ status: 'running' }),

  reset: () =>
    set((s) => ({
      status: 'idle',
      phase: 'focus',
      secondsLeft: s.focusMin * 60,
      startedAt: null,
      focusLocked: false,
    })),

  tick: () =>
    set((s) => ({ secondsLeft: Math.max(0, s.secondsLeft - 1) })),

  /** Move to break phase after a completed focus block. */
  startBreak: () =>
    set((s) => ({
      status: 'running',
      phase: 'break',
      secondsLeft: s.breakMin * 60,
      startedAt: Date.now(),
    })),

  bumpCompleted: () => set((s) => ({ justCompleted: s.justCompleted + 1 })),

  endToIdle: () =>
    set((s) => ({ status: 'idle', phase: 'focus', secondsLeft: s.focusMin * 60, startedAt: null, focusLocked: false })),
})
