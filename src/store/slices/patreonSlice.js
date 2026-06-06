/**
 * Public wall-of-honor state. Hydrated by a single cached listener in
 * FirestoreSyncProvider; components read it without their own subscription.
 */
export const createPatreonSlice = (set) => ({
  verifiedPatreons: [],
  setVerifiedPatreons: (verifiedPatreons) => set({ verifiedPatreons }),
})
