/**
 * UI state — focused-zoom widget, open panels, distraction-free Focus overlay
 * context, and the user's typography preference. Pure: no Firebase imports.
 *
 * `fontScale` is hydrated from localStorage so the preference survives reloads
 * without paying for a Firestore round-trip on cold start.
 */
const FONT_SCALE_KEY = 'protrack:fontScale'
const VALID_FONT_SCALES = ['tiny', 'compact', 'standard', 'large', 'huge']

const FONT_FAMILY_KEY = 'protrack:fontFamily'
const VALID_FONT_FAMILIES = ['dmsans', 'inter', 'outfit', 'lora', 'playfair', 'mono']

function readInitialFontScale() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(FONT_SCALE_KEY)
    return VALID_FONT_SCALES.includes(v) ? v : 'standard'
  } catch {
    return 'standard'
  }
}

function readInitialFontFamily() {
  try {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem(FONT_FAMILY_KEY)
    // DM Sans is the design-system default; a stored choice always wins.
    return VALID_FONT_FAMILIES.includes(v) ? v : 'dmsans'
  } catch {
    return 'dmsans'
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
  fontFamily: readInitialFontFamily(),

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

  setFontFamily: (fontFamily) => {
    if (!VALID_FONT_FAMILIES.includes(fontFamily)) return
    try {
      localStorage.setItem(FONT_FAMILY_KEY, fontFamily)
    } catch {
      /* private mode */
    }
    set({ fontFamily })
  },

  openFocus: (focusContext) => set({ focusContext }),
  closeFocus: () => set({ focusContext: null }),

  // Hands-free Mode background loop states
  handsFreeActive: false,
  handsFreeStatus: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking'
  handsFreeFeedback: null, // { query: string, reply: string } | null
  setHandsFreeActive: (handsFreeActive) => set({ handsFreeActive }),
  setHandsFreeStatus: (handsFreeStatus) => set({ handsFreeStatus }),
  setHandsFreeFeedback: (handsFreeFeedback) => set({ handsFreeFeedback }),
})

