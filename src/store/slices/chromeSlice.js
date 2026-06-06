/**
 * Ambient-chrome visibility. Driven by useAutoHideChrome (pointer proximity +
 * focus state). Kept as one boolean so the spring wrappers stay cheap.
 */
export const createChromeSlice = (set) => ({
  chromeHidden: false,
  setChromeHidden: (chromeHidden) => set({ chromeHidden }),
})
