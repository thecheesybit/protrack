import { ymd } from '@/lib/dates'

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

const COLLAPSED_KEY_PREFIX = 'protrack:widget_collapsed:'

/** Rebuild the per-widget collapsed map from its localStorage keys. */
function readInitialCollapsed() {
  const out = {}
  try {
    if (typeof localStorage === 'undefined') return out
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(COLLAPSED_KEY_PREFIX) && localStorage.getItem(k) === '1') {
        out[k.slice(COLLAPSED_KEY_PREFIX.length)] = true
      }
    }
  } catch {
    /* private mode */
  }
  return out
}

function persistCollapsed(id, val) {
  try {
    localStorage.setItem(`${COLLAPSED_KEY_PREFIX}${id}`, val ? '1' : '0')
  } catch {
    /* private mode */
  }
}

const LEGENDS_ENABLED_KEY = 'protrack:timetable_legends_enabled'
function readInitialLegendsEnabled() {
  try {
    if (typeof localStorage === 'undefined') return false
    const val = localStorage.getItem(LEGENDS_ENABLED_KEY)
    return val === 'true'
  } catch {
    return false
  }
}

export const createUiSlice = (set, get) => ({
  maximizedWidgetId: null,
  activeWidgetId: 'timetable',
  settingsOpen: false,
  aiOpen: false,
  supportOpen: false,
  fullscreen: false,
  clockCentered: false,
  focusContext: null, // { title, color, subjectId?, slotId? } | null
  fontScale: readInitialFontScale(),
  fontFamily: readInitialFontFamily(),

  // Timetable dynamic hover inspector & subject legends
  hoveredTimetableItem: null, // { type: 'slot'|'event'|'task', data, subject } | null
  hoveredSubjectId: null, // string | null (to highlight all slots of this subject)
  timetableLegendsPinned: typeof localStorage !== 'undefined' && localStorage.getItem('protrack:timetable_legends_pinned') === 'true',
  timetableLegendsExpanded: false,

  // Workspaces & Widgets bottom dock state
  bottomDockOpen: false,
  setBottomDockOpen: (open) => {
    const next = typeof open === 'function' ? open(get().bottomDockOpen) : Boolean(open)
    if (next) {
      // Mutual exclusion: opening bottom dock closes timetable legends
      set({ bottomDockOpen: true, timetableLegendsExpanded: false })
    } else {
      set({ bottomDockOpen: false })
    }
  },

  // Selected Scope Dropdown state
  scopeDropdownOpen: false,
  setScopeDropdownOpen: (open) => {
    const next = typeof open === 'function' ? open(get().scopeDropdownOpen) : Boolean(open)
    if (next) {
      // While scope dropdown is open, legend always closes and cannot open
      set({ scopeDropdownOpen: true, timetableLegendsExpanded: false })
    } else {
      // When scope list goes back up, pill reappears!
      set({ scopeDropdownOpen: false, modeRailOpen: true })
    }
  },

  // Mode Switcher Vertical Rail ("The Pill")
  modeRailOpen: true,
  setModeRailOpen: (open) => {
    const next = typeof open === 'function' ? open(get().modeRailOpen) : Boolean(open)
    if (next) {
      // If pill opens, legend closes
      set({ modeRailOpen: true, timetableLegendsExpanded: false })
    } else {
      // Both can be closed at the same time
      set({ modeRailOpen: false })
    }
  },

  setActiveWidgetId: (activeWidgetId) => set({ activeWidgetId }),
  maximizeWidget: (id) => set({ maximizedWidgetId: id, activeWidgetId: id || 'timetable' }),
  restoreWidgets: () => set({ maximizedWidgetId: null }),

  setHoveredTimetableItem: (hoveredTimetableItem) => set({ hoveredTimetableItem }),
  setHoveredSubjectId: (hoveredSubjectId) => set({ hoveredSubjectId }),
  setTimetableLegendsPinned: (timetableLegendsPinned) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('protrack:timetable_legends_pinned', timetableLegendsPinned ? 'true' : 'false')
      }
    } catch { /* private mode */ }
    set({ timetableLegendsPinned })
  },

  // L key toggle for legends on / off
  timetableLegendsEnabled: readInitialLegendsEnabled(),
  setTimetableLegendsEnabled: (enabled) => {
    const next = typeof enabled === 'function' ? enabled(get().timetableLegendsEnabled) : Boolean(enabled)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LEGENDS_ENABLED_KEY, next ? 'true' : 'false')
      }
    } catch { /* private mode */ }
    if (!next) {
      // When toggled off, legend closes and remains closed
      set({ timetableLegendsEnabled: false, timetableLegendsExpanded: false })
    } else {
      // When toggled on, enable and expand legends (unless selecting scope)
      if (get().scopeDropdownOpen) {
        set({ timetableLegendsEnabled: true })
        return
      }
      set({
        timetableLegendsEnabled: true,
        timetableLegendsExpanded: true,
        modeRailOpen: false,
        bottomDockOpen: false,
      })
    }
  },
  toggleTimetableLegends: () => {
    const enabled = get().timetableLegendsEnabled
    const expanded = get().timetableLegendsExpanded
    if (!enabled) {
      // Toggled off -> turn on and expand
      get().setTimetableLegendsEnabled(true)
    } else if (expanded) {
      // Toggled on & expanded -> turn off and close
      get().setTimetableLegendsEnabled(false)
    } else {
      // Toggled on but closed -> expand
      get().setTimetableLegendsExpanded(true)
    }
  },

  setTimetableLegendsExpanded: (open) => {
    const next = typeof open === 'function' ? open(get().timetableLegendsExpanded) : Boolean(open)
    if (next) {
      // Guard: if legends are toggled off, or while selecting scope, legend CANNOT open
      if (!get().timetableLegendsEnabled || get().scopeDropdownOpen) {
        set({ timetableLegendsExpanded: false })
        return
      }
      // If legend opens and pill is open, pill closes
      // Both can't be open at the same time
      set({
        timetableLegendsExpanded: true,
        modeRailOpen: false,
        bottomDockOpen: false,
      })
    } else {
      // Both can be closed at the same time
      set({ timetableLegendsExpanded: false })
    }
  },

  // Day synchronization across Timetable, To-dos, and other day-linked widgets
  selectedDate: ymd(new Date()),
  setSelectedDate: (dateOrStr) => {
    if (!dateOrStr) return
    let str = dateOrStr
    if (dateOrStr instanceof Date) {
      str = ymd(dateOrStr)
    } else if (typeof dateOrStr === 'string' && dateOrStr.length > 10) {
      const d = new Date(dateOrStr)
      if (!isNaN(d.getTime())) str = ymd(d)
    }
    set({ selectedDate: str })
  },
  resetSelectedDate: () => set({ selectedDate: ymd(new Date()) }),
  toggleWidget: (id) =>
    set((s) => ({
      maximizedWidgetId: s.maximizedWidgetId === id ? null : id,
      activeWidgetId: id || s.activeWidgetId || 'timetable',
    })),

  // Per-widget "minimized to header" state — lifted out of WidgetFrame so the
  // board can react (e.g. auto-promote a dock widget into a collapsed slot).
  collapsedWidgets: readInitialCollapsed(),
  setWidgetCollapsed: (id, val) =>
    set((s) => {
      const next = Boolean(val)
      if (Boolean(s.collapsedWidgets[id]) === next) return s
      persistCollapsed(id, next)
      const collapsedWidgets = { ...s.collapsedWidgets }
      if (next) collapsedWidgets[id] = true
      else delete collapsedWidgets[id]
      return { collapsedWidgets }
    }),
  toggleWidgetCollapsed: (id) =>
    set((s) => {
      const next = !s.collapsedWidgets[id]
      persistCollapsed(id, next)
      const collapsedWidgets = { ...s.collapsedWidgets }
      if (next) collapsedWidgets[id] = true
      else delete collapsedWidgets[id]
      return { collapsedWidgets }
    }),

  setClockCentered: (clockCentered) => set({ clockCentered }),
  toggleClockCentered: () => set((s) => ({ clockCentered: !s.clockCentered })),

  alarmModalOpen: false,
  setAlarmModalOpen: (alarmModalOpen) =>
    set((s) => ({
      alarmModalOpen:
        typeof alarmModalOpen === 'function' ? alarmModalOpen(s.alarmModalOpen) : alarmModalOpen,
    })),
  activeRingingAlarm: null,
  setActiveRingingAlarm: (activeRingingAlarm) => set({ activeRingingAlarm }),

  whatsNewOpen: false,
  setWhatsNewOpen: (whatsNewOpen) => set({ whatsNewOpen }),
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

  // Deep-link into Deep Focus. Sets the overlay context (read unchanged by
  // FocusPanel, FocusMiniOverlay and useAutoHideChrome) and ALSO records the
  // origin on the P7 nav bus via `openModule('focus', …)`. `activate: false`
  // means the board is left untouched — FocusPanel's z-50 overlay stays the
  // visible surface — so every existing caller behaves exactly as before.
  openFocus: (focusContext) => {
    set({ focusContext })
    const openModule = get()?.openModule
    if (typeof openModule === 'function') {
      openModule('focus', {
        itemType: focusContext?.subjectId
          ? 'subject'
          : focusContext?.slotId
            ? 'slot'
            : 'focus',
        itemId: focusContext?.subjectId || focusContext?.slotId || null,
        subjectId: focusContext?.subjectId || null,
        activate: false,
      })
    }
  },
  closeFocus: () => set({ focusContext: null }),

  // Hands-free Mode background loop states
  handsFreeActive: false,
  handsFreeStatus: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking'
  handsFreeFeedback: null, // { query: string, reply: string } | null
  setHandsFreeActive: (handsFreeActive) => set({ handsFreeActive }),
  setHandsFreeStatus: (handsFreeStatus) => set({ handsFreeStatus }),
  setHandsFreeFeedback: (handsFreeFeedback) => set({ handsFreeFeedback }),
})

