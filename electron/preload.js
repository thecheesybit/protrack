import { contextBridge, ipcRenderer } from 'electron'

// Subscribe to a main→renderer channel; returns an unsubscribe function.
const subscribe = (channel, cb) => {
  const handler = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

/**
 * The ONLY bridge between renderer and main. Everything is an explicit,
 * promise-based, whitelisted call — no raw ipcRenderer is ever exposed.
 */
contextBridge.exposeInMainWorld('protrack', {
  isDesktop: true,
  platform: process.platform,

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },

  // OS keychain / DPAPI-backed session storage.
  secureStore: {
    set: (value) => ipcRenderer.invoke('secure:set', value),
    get: () => ipcRenderer.invoke('secure:get'),
    clear: () => ipcRenderer.invoke('secure:clear'),
  },

  // Stable hardware fingerprint (computed in main; raw traits never exposed).
  getDeviceFingerprint: () => ipcRenderer.invoke('device:fingerprint'),

  // Global-hotkey → focus pause/resume. Returns an unsubscribe fn.
  onFocusToggle: (cb) => subscribe('shortcut:focus-toggle', () => cb()),

  // Over-the-air auto-update lifecycle. Each subscriber returns an unsubscribe fn.
  update: {
    onAvailable: (cb) => subscribe('update:available', cb),
    onProgress: (cb) => subscribe('update:progress', cb),
    onDownloaded: (cb) => subscribe('update:downloaded', cb),
    onError: (cb) => subscribe('update:error', cb),
    install: () => ipcRenderer.invoke('update:install'),
  },

  appInfo: () => ipcRenderer.invoke('app:info'),
})
