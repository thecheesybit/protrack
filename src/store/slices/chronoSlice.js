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
import { getInitialChronoSlot } from '@/lib/chrono'

export const createChronoSlice = (set) => ({
  chronoSlot: getInitialChronoSlot(), // Synchronously resolved to avoid flashing morning slot on load

  /** @param {ChronoSlot} chronoSlot */
  setChronoSlot: (chronoSlot) => set({ chronoSlot }),
})
