/* global __APP_VERSION__ */

/**
 * App version, baked in from package.json at build time (see vite.config.js
 * `define`). Use this for any UI that displays the version so it can never drift
 * from the real release. Falls back to '0.0.0' under test (no Vite define).
 *
 * On desktop, `desktopBridge.appInfo().version` (from Electron `app.getVersion()`)
 * is equivalent — both come from the same package.json at build time — so this
 * constant is the simplest single source for display.
 */
export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ !== '0.0.0'
    ? __APP_VERSION__
    : '2.6.0'
