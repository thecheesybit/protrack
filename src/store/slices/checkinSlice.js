/**
 * Daily check-in state. `checkins` mirrors the bounded Firestore listener
 * (hydrated by useCheckIns). Prompting itself now runs through `promptSlice`
 * (P4's center-blur queue) — this slice only holds the recent day-docs.
 */
export const createCheckinSlice = (set) => ({
  checkins: [], // recent day-docs, newest first

  setCheckins: (checkins) => set({ checkins }),
})
