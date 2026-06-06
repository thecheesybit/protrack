/** True when running inside the Electron shell (preload exposes window.protrack). */
export const isDesktop =
  typeof window !== 'undefined' && Boolean(window.protrack?.isDesktop)

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
