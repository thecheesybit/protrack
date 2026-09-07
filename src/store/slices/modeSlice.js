/**
 * Workspace "Modes" — the partition key for all context-scoped data.
 * Switching the active mode swaps the entire board context downstream.
 * Side-effects (persisting the choice to Firestore) live in services, not here.
 */
export const createModeSlice = (set, get) => ({
  modes: [],
  activeModeId: 'all',
  modesLoading: true,

  setModes: (modes) => set({ modes, modesLoading: false }),
  setActiveModeId: (activeModeId) => set({ activeModeId }),

  getActiveMode: () => {
    const { modes, activeModeId } = get()
    return modes.find((m) => m.id === activeModeId) || null
  },
})
