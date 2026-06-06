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

  appInfo: () => ipcRenderer.invoke('app:info'),
})
