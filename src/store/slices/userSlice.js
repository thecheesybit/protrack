/**
 * Mirror of the user root document (settings + gamification stats), hydrated
 * by FirestoreSyncProvider so widgets can read them without their own listener.
 */
export const createUserSlice = (set) => ({
  userDoc: null,
  settings: null,
  stats: null,
  syncError: null,
  setUserDoc: (data) =>
    set({
      userDoc: data || null,
      settings: data?.settings || null,
      stats: data?.statsAggregate || null,
    }),
  setSyncError: (error) => set({ syncError: error }),
})
