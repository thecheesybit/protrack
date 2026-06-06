/**
 * Auto-update state, fed by Electron's autoUpdater via useAutoUpdate. When an
 * update is downloading or ready, the UpdateGate obscures the dashboard and
 * background operations are frozen — older clients cannot keep running stale.
 *
 * @typedef {'idle'|'checking'|'up-to-date'|'downloading'|'ready'|'error'} UpdateStatus
 */
export const createUpdateSlice = (set) => ({
  updateStatus: 'idle',
  updateVersion: null,
  updateProgress: 0,
  updateError: null,
  updateLastCheck: null,

  reportUpdateChecking: () =>
    set({ updateStatus: 'checking', updateError: null, updateLastCheck: Date.now() }),

  reportUpdateNotAvailable: () =>
    set((s) => (s.updateStatus === 'downloading' || s.updateStatus === 'ready'
      ? {}
      : { updateStatus: 'up-to-date', updateLastCheck: Date.now() })),

  reportUpdateAvailable: (version) =>
    set({
      updateStatus: 'downloading',
      updateVersion: version || null,
      updateProgress: 0,
      updateError: null,
    }),

  reportUpdateProgress: (percent) =>
    set((s) =>
      s.updateStatus === 'ready'
        ? {}
        : { updateStatus: 'downloading', updateProgress: Math.max(0, Math.min(100, percent || 0)) },
    ),

  reportUpdateReady: (version) =>
    set({ updateStatus: 'ready', updateVersion: version || null, updateProgress: 100 }),

  reportUpdateError: (message) =>
    set((s) => (s.updateStatus === 'downloading' || s.updateStatus === 'ready'
      ? {}
      : { updateStatus: 'error', updateError: message || 'Update check failed.' })),
})
