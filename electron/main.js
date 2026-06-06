import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  shell,
  safeStorage,
  nativeImage,
  globalShortcut,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL

// Built layout: dist-electron/main.js + preload.cjs, dist/ (renderer), build/ (assets)
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD = path.join(__dirname, 'preload.cjs')
const ICON = path.join(__dirname, '../build/icon.png')

let win = null
let tray = null
let isQuitting = false

// System-wide hotkeys (sensible defaults; surfaced read-only in Settings).
const SHORTCUTS = {
  toggleWindow: 'CommandOrControl+Shift+P',
  toggleFocus: 'CommandOrControl+Shift+Space',
  toggleFullScreen: 'CommandOrControl+Shift+F',
  hideToTray: 'CommandOrControl+Shift+H',
  toggleMute: 'CommandOrControl+Shift+M',
}

// Permissions auto-granted to the app (it is first-party, contextIsolated).
// Lets the voice assistant capture the mic without a manual prompt.
const GRANTED_PERMISSIONS = new Set([
  'media',
  'audioCapture',
  'mediaKeySystem',
  'notifications',
  'clipboard-sanitized-write',
])

const sessionFile = () => path.join(app.getPath('userData'), 'session.enc')

/**
 * Stable, privacy-preserving hardware fingerprint. Hashes durable machine
 * traits (hostname, platform, arch, CPU model, non-internal MACs) so the same
 * device always yields the same id — bound to the account in Firestore — while
 * the raw identifiers never leave the machine.
 */
function deviceFingerprint() {
  const nets = os.networkInterfaces()
  const macs = Object.values(nets)
    .flat()
    .filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00')
    .map((n) => n.mac)
  const cpu = os.cpus()?.[0]?.model || ''
  const raw = [os.hostname(), os.platform(), os.arch(), cpu, [...new Set(macs)].sort().join(',')].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

function toggleWindow() {
  if (!win) return createWindow()
  if (win.isVisible() && win.isFocused()) win.hide()
  else {
    win.show()
    win.focus()
  }
}

/**
 * Over-the-air updates from the GitHub release feed. Older clients download the
 * new build automatically; the renderer's UpdateGate obscures the dashboard and
 * offers a one-click restart. Only runs in packaged builds.
 */
function initAutoUpdate() {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  const send = (channel, payload) => win?.webContents.send(channel, payload)
  autoUpdater.on('update-available', (info) => send('update:available', { version: info?.version }))
  autoUpdater.on('download-progress', (p) => send('update:progress', { percent: Math.round(p?.percent || 0) }))
  autoUpdater.on('update-downloaded', (info) => send('update:downloaded', { version: info?.version }))
  autoUpdater.on('error', (err) => send('update:error', { message: String(err?.message || err) }))
  autoUpdater.checkForUpdates().catch(() => {})
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#09090e',
    icon: ICON,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // ESM preload needs sandbox off; contextIsolation still isolates
      // Keep the Pomodoro tick, alarms, and chimes alive when minimized/in tray.
      backgroundThrottling: false,
    },
  })

  // Auto-approve first-party permission requests (microphone for the voice
  // assistant, notifications, etc.) so the user is never blocked by a prompt.
  const ses = win.webContents.session
  ses.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(GRANTED_PERMISSIONS.has(permission)),
  )
  ses.setPermissionCheckHandler((_wc, permission) => GRANTED_PERMISSIONS.has(permission))

  if (isDev && DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'))

  win.once('ready-to-show', () => win.show())

  // Forward window-state events so the renderer TitleBar always reflects truth.
  win.on('maximize', () => win.webContents.send('window:state', { maximized: true }))
  win.on('unmaximize', () => win.webContents.send('window:state', { maximized: false }))
  win.on('enter-full-screen', () => win.webContents.send('window:state', { fullscreen: true }))
  win.on('leave-full-screen', () => win.webContents.send('window:state', { fullscreen: false }))

  // Minimize to tray instead of quitting.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  // External links open in the system browser; block in-app navigation away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('/__/auth/') || url.includes('firebaseapp.com/__/auth')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const current = win.webContents.getURL()
    const isLocal = url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')
    if (url !== current && !isLocal) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })
}

function createTray() {
  try {
    const image = nativeImage.createFromPath(ICON)
    if (image.isEmpty()) {
      console.warn('[tray] icon not found at', ICON, '— skipping tray creation')
      return
    }
    tray = new Tray(image.resize({ width: 18, height: 18 }))
    tray.setToolTip('PRO TRACK')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open PRO TRACK', click: () => (win ? win.show() : createWindow()) },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuitting = true; app.quit() } },
      ]),
    )
    tray.on('click', () => {
      if (!win) return createWindow()
      win.isVisible() ? win.hide() : win.show()
    })
  } catch (err) {
    console.error('[tray] failed', err)
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (!win.isVisible()) win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    createTray()

    // System-wide hotkeys: toggle visibility, and pause/resume focus (the
    // latter is forwarded to the renderer focus engine).
    const reg = (key, fn) => {
      if (!globalShortcut.register(key, fn))
        console.warn(`[shortcut] failed to register ${key} — may be claimed by another app`)
    }
    reg(SHORTCUTS.toggleWindow, toggleWindow)
    reg(SHORTCUTS.toggleFocus, () =>
      win?.webContents.send('shortcut:focus-toggle'),
    )
    reg(SHORTCUTS.toggleFullScreen, () => {
      if (win) win.setFullScreen(!win.isFullScreen())
    })
    reg(SHORTCUTS.hideToTray, () => win?.hide())
    reg(SHORTCUTS.toggleMute, () =>
      win?.webContents.send('shortcut:mute'),
    )

    initAutoUpdate()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
  })
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && isQuitting) app.quit()
  })
}

/* ── IPC: window controls ───────────────────────────────── */
ipcMain.handle('window:minimize', () => win?.minimize())
ipcMain.handle('window:maximize', () => {
  if (!win) return false
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
  return win.isMaximized()
})
ipcMain.handle('window:close', () => win?.hide())
ipcMain.handle('window:isMaximized', () => win?.isMaximized() ?? false)
ipcMain.handle('window:toggleFullScreen', () => {
  if (!win) return false
  win.setFullScreen(!win.isFullScreen())
  return win.isFullScreen()
})
ipcMain.handle('window:isFullScreen', () => win?.isFullScreen() ?? false)

/* ── IPC: OS-encrypted session storage (safeStorage) ────── */
ipcMain.handle('secure:set', (_e, value) => {
  try {
    if (typeof value !== 'string' || !safeStorage.isEncryptionAvailable()) return false
    fs.writeFileSync(sessionFile(), safeStorage.encryptString(value))
    return true
  } catch (err) {
    console.error('[secure:set]', err)
    return false
  }
})
ipcMain.handle('secure:get', () => {
  try {
    if (!fs.existsSync(sessionFile())) return null
    return safeStorage.decryptString(fs.readFileSync(sessionFile()))
  } catch (err) {
    console.error('[secure:get]', err)
    return null
  }
})
ipcMain.handle('secure:clear', () => {
  try {
    if (fs.existsSync(sessionFile())) fs.unlinkSync(sessionFile())
    return true
  } catch {
    return false
  }
})
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  shortcuts: SHORTCUTS,
}))

/* ── IPC: hardware fingerprint identity ─────────────────── */
ipcMain.handle('device:fingerprint', () => ({
  id: deviceFingerprint(),
  hostname: os.hostname(),
  platform: process.platform,
}))

/* ── IPC: apply downloaded update ───────────────────────── */
ipcMain.handle('update:install', () => {
  try {
    autoUpdater.quitAndInstall()
  } catch (err) {
    console.error('[update:install]', err)
  }
})
