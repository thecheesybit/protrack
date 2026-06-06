import { contextBridge, ipcRenderer } from 'electron'

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
  onFocusToggle: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('shortcut:focus-toggle', handler)
    return () => ipcRenderer.removeListener('shortcut:focus-toggle', handler)
  },

  appInfo: () => ipcRenderer.invoke('app:info'),
})
