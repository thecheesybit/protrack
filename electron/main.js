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
  screen,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL

// Isolate development userData to avoid lockfile collisions (Windows error code 32)
// when an installed production build (PRO TRACK.exe) is running concurrently.
if (isDev) {
  app.setPath('userData', path.join(app.getPath('appData'), 'pro-track-dev'))
}

// Built layout: dist-electron/main.js + preload.cjs, dist/ (renderer), build/ (assets)
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD = path.join(__dirname, 'preload.cjs')
const ICON = path.join(__dirname, '../build/icon.png')

let win = null
let tray = null
let isQuitting = false

// ── Local static server (production) ───────────────────────────────────────
// The packaged renderer is served over http://localhost instead of file://.
// Why: YouTube's IFrame API (enablejsapi, used for the Deep Focus scene volume
// control) refuses to play when the embedding page has the opaque file:// origin
// — that's why the background video worked in dev (http://localhost:5173) but
// not in the packaged build. A real localhost origin fixes it, and localhost is
// already a Firebase-authorized domain, so auth + IndexedDB persistence keep
// working. The port is FIXED so the origin is stable across launches (a changing
// origin would log the user out and drop the offline cache every time).
const LOCAL_HOST = '127.0.0.1'
const LOCAL_PORT_BASE = 41730
let localServer = null
let localPort = null

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

const staticAssetCache = new Map()

function serveIndex(res) {
  const cached = staticAssetCache.get('index.html')
  if (cached) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(cached)
    return
  }
  fs.readFile(path.join(RENDERER_DIST, 'index.html'), (err, html) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    staticAssetCache.set('index.html', html)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })
}

function handleLocalRequest(req, res) {
  let rel
  try {
    rel = decodeURIComponent((req.url || '/').split('?')[0])
  } catch {
    rel = '/'
  }
  if (rel === '/' || rel === '') return serveIndex(res)

  // Resolve inside RENDERER_DIST and refuse anything that escapes it.
  const filePath = path.normalize(path.join(RENDERER_DIST, rel))
  if (filePath !== RENDERER_DIST && !filePath.startsWith(RENDERER_DIST + path.sep)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  const cached = staticAssetCache.get(filePath)
  if (cached) {
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    res.end(cached)
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return serveIndex(res) // SPA fallback for client routes
    const ext = path.extname(filePath).toLowerCase()
    if (data.length < 5 * 1024 * 1024) {
      staticAssetCache.set(filePath, data)
    }
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    res.end(data)
  })
}

/**
 * Start the static server on the fixed port, walking forward a few ports only
 * if it is occupied. Resolves the chosen port, or null if none could bind (the
 * caller then falls back to file://).
 */
function startLocalServer() {
  return new Promise((resolve) => {
    let attempt = 0
    const tryListen = () => {
      const port = LOCAL_PORT_BASE + attempt
      const server = http.createServer(handleLocalRequest)
      server.once('error', (err) => {
        server.close?.()
        if (err.code === 'EADDRINUSE' && attempt < 6) {
          attempt += 1
          tryListen()
        } else {
          resolve(null)
        }
      })
      server.listen(port, LOCAL_HOST, () => {
        localServer = server
        localPort = port
        resolve(port)
      })
    }
    tryListen()
  })
}

// True when running from a Microsoft Store (AppX/MSIX) install. Store builds
// must never self-update — the Store owns delivery, and electron-updater
// cannot write into the sandboxed package directory anyway.
const isStoreBuild = Boolean(process.windowsStore)

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
  if (!app.isPackaged || isStoreBuild) return
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

  // No Referer/Origin spoofing. The packaged app is served over http://localhost
  // (a real origin with a real Referer), so YouTube's enablejsapi handshake works
  // exactly as it does in dev. The old file:// Referer spoof is intentionally
  // gone — with a real origin it would only re-create the origin/referer mismatch
  // that broke playback.
  //
  // The app document's CSP is a build-time <meta> tag (vite.config.js,
  // injectCspPlugin) governing only our own document — never reintroduce a
  // session-wide onHeadersReceived CSP: it would stamp our policy onto YouTube's
  // own responses and kill the embed's streaming XHRs.

  if (isDev && DEV_URL) {
    win.loadURL(DEV_URL)
  } else if (localPort) {
    // Production: real localhost origin so YouTube + Firebase behave.
    win.loadURL(`http://localhost:${localPort}/`)
  } else {
    // Last-resort fallback if the local server failed to bind.
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

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
      // Never persist the tiny PiP bounds — they'd become the window's remembered
      // "normal" size and it would reopen as a 240×240 box next launch.
      if (prePipState) return
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
  win.on('minimize', () => {
    win.webContents?.send('window:state', { minimized: true })
  })
  win.on('restore', () => {
    win.webContents?.send('window:state', { restored: true, minimized: false })
  })
  win.on('hide', () => {
    win.webContents?.send('window:state', { hidden: true })
  })
  win.on('show', () => {
    win.webContents?.send('window:state', { shown: true, hidden: false })
  })

  // Minimize to tray instead of quitting (production only). In dev, close quits
  // the app so running `npm run electron:dev` doesn't collide with a hidden tray instance.
  win.on('close', (e) => {
    if (prePipState) {
      win.setAlwaysOnTop(false)
      win.setMinimumSize(940, 600)
      prePipState = null
    }
    if (isDev) {
      isQuitting = true
      app.quit()
      return
    }
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  // External links open in the system browser; block in-app navigation away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    // 1. Native Document Picture-in-Picture window (Chromium uses about:blank)
    if (url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          alwaysOnTop: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      }
    }
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
    // Only launch system browser for external http/https links (never internal about: protocols)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
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

// Must be called before app.whenReady() — webPreferences.autoplayPolicy only
// affects the main renderer. Cross-origin iframes (YouTube) run in a separate
// renderer process and require this Chromium-level switch to autoplay with audio.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// GPU rendering path — crisp, hardware-accelerated output on HiDPI / 4K.
// `ignore-gpu-blocklist` stops Chromium from silently falling back to the
// software renderer on drivers it distrusts (a common cause of blurry, sluggish
// output); the rasterization switches move layer + canvas painting onto the GPU
// so text, blur, and gradients stay sharp when the OS scales the display.
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('canvas-oop-rasterization')
// High-quality downscaling for images/video so 4K content isn't nearest-neighbor.
app.commandLine.appendSwitch('force-color-profile', 'srgb')

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

  app.whenReady().then(async () => {
    // Production: bring up the localhost static server before the first window so
    // createWindow can load http://localhost instead of file:// (see the server
    // block above for why). Dev uses the Vite server and skips this.
    if (!isDev) await startLocalServer()
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
    localServer?.close?.()
  })
  app.on('window-all-closed', () => {
    if (isDev || (process.platform !== 'darwin' && isQuitting)) app.quit()
  })
}

/* ── IPC: window controls ───────────────────────────────── */
ipcMain.handle('window:minimize', () => {
  win?.webContents?.send('window:state', { minimized: true })
  return win?.minimize()
})
ipcMain.handle('window:restore', () => {
  if (!win) return false
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return true
})
ipcMain.handle('window:maximize', () => {
  if (!win) return false
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
  return win.isMaximized()
})
ipcMain.handle('window:close', () => {
  win?.webContents?.send('window:state', { hidden: true })
  return win?.hide()
})
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

/* ── IPC: native PiP mini-widget morphing ───────────────── */
// Bounds of the floating always-on-top square while in Picture-in-Picture.
const PIP_WIDTH = 240
const PIP_HEIGHT = 240
const PIP_MIN_SIZE = 160 // lowered minimum so setBounds isn't clamped
const PIP_SCREEN_MARGIN = 24 // gap from the working-area edge
let prePipState = null

ipcMain.handle('pip:enter', async () => {
  if (!win) return false
  const wasFullScreen = win.isFullScreen()
  const wasMaximized = win.isMaximized()
  prePipState = {
    bounds: win.getNormalBounds ? win.getNormalBounds() : win.getBounds(),
    isFullScreen: wasFullScreen,
    isMaximized: wasMaximized,
  }

  // Lower the minimum size FIRST, else setBounds is clamped to the old minimum.
  win.setMinimumSize(PIP_MIN_SIZE, PIP_MIN_SIZE)
  win.setResizable(true)

  // A compact always-on-top square — just the floating timer, like a video PiP.
  const applyPipBounds = () => {
    if (!win || win.isDestroyed()) return
    const display = screen.getDisplayMatching(win.getBounds()) || screen.getPrimaryDisplay()
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea
    win.setBounds({
      x: Math.round(dx + dw - PIP_WIDTH - PIP_SCREEN_MARGIN),
      y: Math.round(dy + dh - PIP_HEIGHT - PIP_SCREEN_MARGIN),
      width: PIP_WIDTH,
      height: PIP_HEIGHT,
    })
    try {
      win.setAlwaysOnTop(true, 'screen-saver')
    } catch {
      win.setAlwaysOnTop(true)
    }
    win.show()
    win.focus()
  }

  // Leaving fullscreen/maximize is async on Windows; resizing mid-transition is
  // ignored (the OS restores the pre-transition bounds). So exit first, wait for
  // it to settle (event + fallback timeout), then apply — and apply once more a
  // tick later to defeat any late restore.
  if (wasFullScreen) {
    win.setFullScreen(false)
    await new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (!done) {
          done = true
          resolve()
        }
      }
      win.once('leave-full-screen', finish)
      setTimeout(finish, 500)
    })
  } else if (wasMaximized) {
    win.unmaximize()
    await new Promise((resolve) => setTimeout(resolve, 80))
  }

  applyPipBounds()
  setTimeout(applyPipBounds, 140)
  return true
})

ipcMain.handle('pip:exit', () => {
  if (!win) return false
  win.setAlwaysOnTop(false)
  win.setMinimumSize(940, 600)

  if (prePipState) {
    const { bounds, isMaximized, isFullScreen } = prePipState
    prePipState = null
    if (bounds) {
      win.setBounds(bounds)
    }
    if (isMaximized) {
      win.maximize()
    }
    if (isFullScreen) {
      win.setFullScreen(true)
    }
  } else {
    win.setSize(1280, 820)
    win.center()
  }

  win.show()
  win.focus()
  return true
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
  storeBuild: isStoreBuild,
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
  if (isStoreBuild)
    return { ok: false, error: 'This install updates through the Microsoft Store.' }
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
