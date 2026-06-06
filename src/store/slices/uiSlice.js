/**
 * UI state — focused-zoom widget, open panels, distraction-free Focus overlay
 * context, and the user's typography preference. Pure: no Firebase imports.
 *
 * `fontScale` is hydrated from localStorage so the preference survives reloads
 * without paying for a Firestore round-trip on cold start.
 */
const FONT_SCALE_KEY = 'protrack:fontScale'
const VALID_FONT_SCALES = ['compact', 'standard', 'large']

function readInitialFontScale() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(FONT_SCALE_KEY)
    return VALID_FONT_SCALES.includes(v) ? v : 'standard'
  } catch {
    return 'standard'
  }
}

export const createUiSlice = (set) => ({
  maximizedWidgetId: null,
  settingsOpen: false,
  aiOpen: false,
  supportOpen: false,
  fullscreen: false,
  focusContext: null, // { title, color, subjectId?, slotId? } | null
  fontScale: readInitialFontScale(),

  maximizeWidget: (id) => set({ maximizedWidgetId: id }),
  restoreWidgets: () => set({ maximizedWidgetId: null }),
  toggleWidget: (id) =>
    set((s) => ({
      maximizedWidgetId: s.maximizedWidgetId === id ? null : id,
    })),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
  setSupportOpen: (supportOpen) => set({ supportOpen }),
  setFullscreen: (fullscreen) => set({ fullscreen }),

  setFontScale: (fontScale) => {
    if (!VALID_FONT_SCALES.includes(fontScale)) return
    try {
      localStorage.setItem(FONT_SCALE_KEY, fontScale)
    } catch {
      /* private mode — fall through, in-memory state still updates */
    }
    set({ fontScale })
  },

  openFocus: (focusContext) => set({ focusContext }),
  closeFocus: () => set({ focusContext: null }),
})
