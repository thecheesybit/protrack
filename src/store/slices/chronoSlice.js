/**
 * Chrono-adaptive aesthetics state. Holds the current time-of-day slot; the
 * orchestration (reading the local clock, writing the data-chrono attribute)
 * lives in useChronoTheme so this slice stays pure.
 *
 * The 7-slot theme (docs/DESIGN_SYSTEM.md §6) turns the whole canvas with the
 * sky: parchment through the working day, near-black warm/rose/violet tones at
 * dawn/dusk/evening/deep night — in both light and dark themes.
 *
 * @typedef {'deep_night'|'dawn'|'morning'|'midday'|'afternoon'|'dusk'|'evening'} ChronoSlot
 */
export const createChronoSlice = (set) => ({
  chronoSlot: 'morning', // ChronoSlot — corrected by useChronoTheme on mount

  /** @param {ChronoSlot} chronoSlot */
  setChronoSlot: (chronoSlot) => set({ chronoSlot }),
})
