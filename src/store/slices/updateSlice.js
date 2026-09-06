/**
 * Auto-update state, fed by Electron's autoUpdater via useAutoUpdate. Status
 * transitions are surfaced as non-blocking Dynamic Island notifications
 * (download progress → "ready to install"); a running focus session is paused
 * while an update downloads. Settings also reads this for its diagnostics row.
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

  // Errors apply in every state except 'ready' — once the update is fully
  // downloaded, a late transient error must not hide the install button. An
  // error DURING download, however, must surface: swallowing it left the UI
  // stuck on "downloading" forever with no recovery path.
  reportUpdateError: (message) =>
    set((s) => (s.updateStatus === 'ready'
      ? {}
      : { updateStatus: 'error', updateError: message || 'Update check failed.' })),
})
