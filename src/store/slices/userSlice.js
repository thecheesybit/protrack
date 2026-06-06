/**
 * Mirror of the user root document (settings + gamification stats), hydrated
 * by FirestoreSyncProvider so widgets can read them without their own listener.
 */
export const createUserSlice = (set) => ({
  settings: null,
  stats: null,
  setUserDoc: (data) =>
    set({
      settings: data?.settings || null,
      stats: data?.statsAggregate || null,
    }),
})
