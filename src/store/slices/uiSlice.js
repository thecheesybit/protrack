/**
 * UI state — which widget is maximized (focused-zoom) and which panels are open.
 * Pure: no Firebase imports, so it stays trivially testable.
 */
export const createUiSlice = (set) => ({
  maximizedWidgetId: null,
  settingsOpen: false,
  aiOpen: false,

  maximizeWidget: (id) => set({ maximizedWidgetId: id }),
  restoreWidgets: () => set({ maximizedWidgetId: null }),
  toggleWidget: (id) =>
    set((s) => ({
      maximizedWidgetId: s.maximizedWidgetId === id ? null : id,
    })),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAiOpen: (aiOpen) => set({ aiOpen }),
})
