/** True when running inside the Electron shell (preload exposes window.protrack). */
export const isDesktop =
  typeof window !== 'undefined' && Boolean(window.protrack?.isDesktop)

/** Safe accessor for the preload bridge. */
export const desktopBridge = typeof window !== 'undefined' ? window.protrack : undefined
