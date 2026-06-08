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
const windowStateFile = () => path.join(app.getPath('userData'), 'window-state.json')

/**
 * Persisted window bounds. We roll our own (rather than depend on
 * electron-store) to keep the Electron main bundle lean and dependency-free,
 * and because the schema is tiny.
 */
const DEFAULT_WINDOW_STATE = {
  width: 1280,
  height: 820,
  x: undefined,
  y: undefined,
  isMaximized: false,
  isFullScreen: false,
}

function readWindowState() {
  try {
    if (!fs.existsSync(windowStateFile())) return { ...DEFAULT_WINDOW_STATE }
    const raw = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'))
    return {
      ...DEFAULT_WINDOW_STATE,
      ...raw,
      // Defensive: numeric, sane minimums in case the file was tampered with.
      width: Math.max(940, Number(raw.width) || DEFAULT_WINDOW_STATE.width),
      height: Math.max(600, Number(raw.height) || DEFAULT_WINDOW_STATE.height),
    }
  } catch (err) {
    console.warn('[window-state] read failed; using defaults', err)
    return { ...DEFAULT_WINDOW_STATE }
  }
}

function persistWindowState(state) {
  try {
    fs.writeFileSync(windowStateFile(), JSON.stringify(state, null, 2))
  } catch (err) {
    console.warn('[window-state] write failed', err)
  }
}

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
 * Transient network/CDN failures (GitHub 502/503/504, timeouts, DNS, dropped
 * sockets) are routine and self-heal on the next check — they must NOT be shown
 * to the user as "Update failed". electron-updater polls GitHub's releases feed,
 * which 504s during GitHub hiccups; we classify those, retry quietly, and only
 * surface genuinely persistent errors (e.g. a missing/corrupt release).
 */
const TRANSIENT_UPDATE_ERROR =
  /(\b50[234]\b|gateway\s*time-?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network|net::|timed?\s*out)/i
function isTransientUpdateError(err) {
  return TRANSIENT_UPDATE_ERROR.test(String(err?.message || err || ''))
}

/**
 * Over-the-air updates from the GitHub release feed. Older clients download the
 * new build automatically; the renderer surfaces progress + a one-click restart
 * via the Dynamic Island (see useAutoUpdate). Only runs in packaged builds.
 *
 * Hardening:
 *  - Transient GitHub/network errors (504s, timeouts) are retried with backoff
 *    and NEVER reach the UI — only persistent errors surface. This is what kept
 *    flashing "Update failed" at users during GitHub's intermittent 504s.
 *  - Lifecycle events are forwarded to the renderer so Settings shows real
 *    status; the initial check runs immediately, then every 15 min for the
 *    first hour, then hourly.
 *  - Focus re-checks are debounced (≥10 min apart) so window-flipping doesn't
 *    hammer GitHub and multiply the odds of a transient failure.
 *  - Manual `update:check` IPC lets the user force a check from Settings.
 */
function initAutoUpdate() {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel, payload) => win?.webContents.send(channel, payload)
  let lastCheckAt = 0

  autoUpdater.on('checking-for-update', () => send('update:checking', {}))
  autoUpdater.on('update-available', (info) =>
    send('update:available', { version: info?.version }),
  )
  autoUpdater.on('update-not-available', (info) =>
    send('update:notAvailable', { version: info?.version }),
  )
  autoUpdater.on('download-progress', (p) =>
    send('update:progress', { percent: Math.round(p?.percent || 0) }),
  )
  autoUpdater.on('update-downloaded', (info) =>
    send('update:downloaded', { version: info?.version }),
  )
  autoUpdater.on('error', (err) => {
    // checkForUpdates() emits 'error' AND rejects; this handler owns what the
    // UI sees, the check() wrapper below owns the quiet backoff retries.
    if (isTransientUpdateError(err)) {
      console.warn('[autoUpdate] transient error:', String(err?.message || err).split('\n')[0])
      return
    }
    console.error('[autoUpdate] error', err)
    send('update:error', { message: String(err?.message || err) })
  })

  const check = (attempt = 0) => {
    lastCheckAt = Date.now()
    autoUpdater.checkForUpdates().catch((err) => {
      if (isTransientUpdateError(err) && attempt < 3) {
        const delay = [30, 90, 180][attempt] * 1000
        console.warn(`[autoUpdate] transient check failure; retrying in ${delay / 1000}s`)
        setTimeout(() => check(attempt + 1), delay)
      }
    })
  }

  check() // immediate
  const fast = setInterval(() => check(), 15 * 60 * 1000)
  setTimeout(() => {
    clearInterval(fast)
    setInterval(() => check(), 60 * 60 * 1000)
  }, 60 * 60 * 1000)

  // Re-check on focus, debounced — catches the wake-from-sleep case without
  // hammering GitHub when the user flips between windows.
  app.on('browser-window-focus', () => {
    if (Date.now() - lastCheckAt > 10 * 60 * 1000) check()
  })
}

function createWindow() {
  const state = readWindowState()
  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 940,
    minHeight: 600,
    // useContentSize: width/height refer to the renderer viewport, not the
    // outer frame — guarantees the React layout gets pixel-exact dimensions
    // on every HiDPI display regardless of OS chrome thickness.
    useContentSize: true,
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
      // Let the Deep Focus YouTube scene autoplay (with sound) without a click —
      // explicit so a future Electron default change can't silently break it.
      autoplayPolicy: 'no-user-gesture-required',
      // Lock zoom at 1.0 so the renderer renders at native device pixels.
      // Any cached zoomLevel from a prior session is ignored.
      zoomFactor: 1.0,
      // Pin the default font sizes so DPI changes never reflow typography.
      defaultFontSize: 16,
      defaultMonospaceFontSize: 13,
    },
  })

  // Belt-and-braces: clear any persisted zoom and disable user zoom shortcuts
  // (Ctrl+/-, pinch). Keeps the UI sharp on every monitor.
  win.webContents.setZoomFactor(1.0)
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1.0)
  })

  // Lock down DevTools in packaged production builds. We intercept the
  // common keyboard shortcuts (F12, Ctrl/Cmd+Shift+I, Ctrl/Cmd+Shift+J,
  // Ctrl/Cmd+Shift+C, Ctrl/Cmd+Alt+I) at the input-event level AND
  // listen for `devtools-opened` as a final safety net to close any
  // DevTools window opened via a path we missed (e.g. context menu).
  // Dev mode keeps full access so the team can still debug locally.
  if (!isDev) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return
      const key = (input.key || '').toLowerCase()
      const blockedFn = key === 'f12'
      const blockedShift = (input.control || input.meta) && input.shift &&
        ['i', 'j', 'c'].includes(key)
      const blockedAlt = (input.control || input.meta) && input.alt && key === 'i'
      if (blockedFn || blockedShift || blockedAlt) {
        event.preventDefault()
      }
    })
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools()
    })
  }

  // Auto-approve first-party permission requests (microphone for the voice
  // assistant, notifications, etc.) so the user is never blocked by a prompt.
  const ses = win.webContents.session
  ses.setPermissionRequestHandler((_wc, permission, callback) =>
    callback(GRANTED_PERMISSIONS.has(permission)),
  )
  ses.setPermissionCheckHandler((_wc, permission) => GRANTED_PERMISSIONS.has(permission))

  if (!isDev) {
    const CSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://*.google.com" +
        " wss://*.firebaseio.com https://*.firebaseio.com" +
        " https://generativelanguage.googleapis.com" +
        " https://securetoken.googleapis.com https://identitytoolkit.googleapis.com",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.firebaseapp.com https://accounts.google.com",
      "media-src 'self' blob: mediastream: https://www.youtube.com https://www.youtube-nocookie.com https://*.googlevideo.com",
      "worker-src blob: 'self'",
    ].join('; ')
    ses.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      })
    })
  }

  if (isDev && DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'))

  win.once('ready-to-show', () => {
    win.show()
    if (state.isMaximized) win.maximize()
    if (state.isFullScreen) win.setFullScreen(true)
  })

  // Persist bounds on resize/move. Debounced via simple timer to avoid disk
  // churn during a drag; flush on close for the final position.
  let saveTimer = null
  const queueSave = () => {
    if (!win || win.isDestroyed()) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const isMaximized = win.isMaximized()
      const isFullScreen = win.isFullScreen()
      // Don't capture the inflated bounds while maximized/fullscreen — keep
      // the prior "normal" bounds so the next unmaximize restores them.
      const bounds = !isMaximized && !isFullScreen ? win.getBounds() : null
      const next = bounds
        ? { ...bounds, isMaximized, isFullScreen }
        : { ...readWindowState(), isMaximized, isFullScreen }
      persistWindowState(next)
    }, 300)
  }
  win.on('resize', queueSave)
  win.on('move', queueSave)

  // Forward window-state events so the renderer TitleBar always reflects truth.
  win.on('maximize', () => {
    queueSave()
    win.webContents.send('window:state', { maximized: true })
  })
  win.on('unmaximize', () => {
    queueSave()
    win.webContents.send('window:state', { maximized: false })
  })
  win.on('enter-full-screen', () => {
    queueSave()
    win.webContents.send('window:state', { fullscreen: true })
  })
  win.on('leave-full-screen', () => {
    queueSave()
    win.webContents.send('window:state', { fullscreen: false })
  })

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
ipcMain.handle('window:setFullScreen', (_e, flag) => {
  if (!win) return false
  win.setFullScreen(flag)
  return win.isFullScreen()
})
ipcMain.handle('window:isFullScreen', () => win?.isFullScreen() ?? false)
ipcMain.handle('window:setAlwaysOnTop', (_e, flag) => {
  if (!win) return false
  win.setAlwaysOnTop(Boolean(flag), 'screen-saver')
  return win.isAlwaysOnTop()
})

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

/* ── IPC: manual update check (triggered from Settings) ─── */
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { ok: false, error: 'Dev build — auto-update disabled.' }
  try {
    const result = await autoUpdater.checkForUpdates()
    return {
      ok: true,
      version: result?.updateInfo?.version || null,
      currentVersion: app.getVersion(),
    }
  } catch (err) {
    const transient = isTransientUpdateError(err)
    return {
      ok: false,
      transient,
      // Don't dump a raw 504 HTML/headers blob into a toast — give a calm,
      // actionable message for the common "GitHub is briefly down" case.
      error: transient
        ? 'GitHub is temporarily unavailable. Please try again in a moment.'
        : String(err?.message || err),
    }
  }
})
