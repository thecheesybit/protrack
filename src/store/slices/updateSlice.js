/**
 * Auto-update state, fed by Electron's autoUpdater via useAutoUpdate. When an
 * update is downloading or ready, the UpdateGate obscures the dashboard and
 * background operations are frozen — older clients cannot keep running stale.
 *
 * @typedef {'idle'|'downloading'|'ready'|'error'} UpdateStatus
 */
export const createUpdateSlice = (set) => ({
  updateStatus: 'idle',
  updateVersion: null,
  updateProgress: 0,

  reportUpdateAvailable: (version) =>
    set({ updateStatus: 'downloading', updateVersion: version || null, updateProgress: 0 }),

  reportUpdateProgress: (percent) =>
    set((s) =>
      s.updateStatus === 'ready'
        ? {}
        : { updateStatus: 'downloading', updateProgress: Math.max(0, Math.min(100, percent || 0)) },
    ),

  reportUpdateReady: (version) =>
    set({ updateStatus: 'ready', updateVersion: version || null, updateProgress: 100 }),

  // Only surface a hard error state if no update was already in flight.
  reportUpdateError: () => set((s) => (s.updateStatus === 'idle' ? { updateStatus: 'error' } : {})),
})
