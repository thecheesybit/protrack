/* global __IS_ELECTRON__ */

/**
 * True when running inside the Electron shell.
 *
 * Two-layer detection:
 *  1. Compile-time: Vite injects `__IS_ELECTRON__` when building with
 *     ELECTRON=true. This is the primary signal — it is available instantly
 *     at module-evaluation time, before any preload or DOM script runs.
 *  2. Runtime: the preload bridge exposes `window.protrack.isDesktop`. Used
 *     as a secondary check and to access IPC methods.
 *
 * The compile-time flag is critical because `window.protrack` may not yet
 * be set when ES module-level code runs (Vite's ESM import chain can
 * evaluate before contextBridge.exposeInMainWorld lands), which previously
 * caused the marketing LandingPage to flash inside the desktop app.
 */
const compileTimeElectron =
  typeof __IS_ELECTRON__ !== 'undefined' && __IS_ELECTRON__

const runtimeElectron =
  typeof window !== 'undefined' && Boolean(window.protrack?.isDesktop)

export const isDesktop = compileTimeElectron || runtimeElectron

/** Safe accessor for the preload bridge. */
export const desktopBridge = typeof window !== 'undefined' ? window.protrack : undefined

// DEV-only escape hatch: preview the functional workspace in a browser via
// `?desktop=1`. `import.meta.env.DEV` is false in a production web build, so the
// deployed Netlify gateway can NEVER render the dashboard — it stays landing +
// mobile-auth only, exactly as the architecture requires.
const devWorkspacePreview =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('desktop') === '1'

/** Hosts permitted to render the functional workspace: Electron app (+ dev preview). */
export const isWorkspaceHost = isDesktop || devWorkspacePreview
