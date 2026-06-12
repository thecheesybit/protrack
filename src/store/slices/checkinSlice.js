/**
 * Daily check-in state. `checkins` mirrors the bounded Firestore listener
 * (hydrated by useCheckIns); `checkinPrompt` is the one question currently
 * offered to the user, local-only — prompting cadence never touches Firestore.
 *
 * @typedef {Object} CheckinPrompt
 * @property {'morning'|'midday'|'evening'} slot
 * @property {import('@/lib/checkin').CheckinQuestion} question
 */
export const createCheckinSlice = (set) => ({
  checkins: [], // recent day-docs, newest first
  checkinPrompt: null, // CheckinPrompt | null

  setCheckins: (checkins) => set({ checkins }),
  setCheckinPrompt: (checkinPrompt) => set({ checkinPrompt }),
  clearCheckinPrompt: () => set({ checkinPrompt: null }),
})
