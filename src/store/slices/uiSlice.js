/**
 * UI state — focused-zoom widget, open panels, and the distraction-free Focus
 * overlay context. Pure: no Firebase imports, so it stays trivially testable.
 */
export const createUiSlice = (set) => ({
  maximizedWidgetId: null,
  settingsOpen: false,
  aiOpen: false,
  focusContext: null, // { title, color, subjectId?, slotId? } | null

  maximizeWidget: (id) => set({ maximizedWidgetId: id }),
  restoreWidgets: () => set({ maximizedWidgetId: null }),
  toggleWidget: (id) =>
    set((s) => ({
      maximizedWidgetId: s.maximizedWidgetId === id ? null : id,
    })),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),

  openFocus: (focusContext) => set({ focusContext }),
  closeFocus: () => set({ focusContext: null }),
})
