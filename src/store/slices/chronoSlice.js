/**
 * Chrono-adaptive aesthetics state. Holds the current time-of-day band; the
 * orchestration (reading the local clock, writing the data-chrono attribute)
 * lives in useChronoTheme so this slice stays pure.
 *
 * The band MODULATES the active theme (surface depth, shadow strength, aurora
 * intensity) — it never flips the user's explicit light/dark choice. Daytime
 * reads crisper; night deepens toward pure obsidian to reduce eye strain.
 *
 * @typedef {'dawn'|'day'|'dusk'|'night'} ChronoBand
 */
export const createChronoSlice = (set) => ({
  chronoBand: 'night', // ChronoBand

  /** @param {ChronoBand} chronoBand */
  setChronoBand: (chronoBand) => set({ chronoBand }),
})
