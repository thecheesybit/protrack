import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  shell,
  safeStorage,
  nativeImage,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL

// Built layout: dist-electron/main.js + preload.mjs, dist/ (renderer), build/ (assets)
const RENDERER_DIST = path.join(__dirname, '../dist')
const PRELOAD = path.join(__dirname, 'preload.mjs')
const ICON = path.join(__dirname, '../build/icon.png')

let win = null
let tray = null
let isQuitting = false

const sessionFile = () => path.join(app.getPath('userData'), 'session.enc')

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
    },
  })

  if (isDev && DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(path.join(RENDERER_DIST, 'index.html'))

  win.once('ready-to-show', () => win.show())

  // Minimize to tray instead of quitting.
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win.hide()
    }
  })

  // External links open in the system browser; block in-app navigation away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const current = win.webContents.getURL()
    if (url !== current && !url.startsWith('http://localhost')) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })
}

function createTray() {
  try {
    const image = nativeImage.createFromPath(ICON)
    tray = new Tray(image.isEmpty() ? image : image.resize({ width: 18, height: 18 }))
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
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
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
}))
