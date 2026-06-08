/**
 * Deprecated: the global accent is now driven by time of day (see
 * `useChronoTheme` + `CHRONO_ACCENT`), which rotates the `--accent*` CSS
 * variables through dawn/day/dusk/night in both light and dark themes.
 *
 * Mode identity is still conveyed by each mode pill's own dot color
 * (`mode.accentColor`) in the ModeSwitcher — but the app-wide accent no longer
 * follows the active mode, so this hook intentionally does nothing. Kept as a
 * no-op to avoid touching call sites; safe to delete once all imports are gone.
 */
export function useModeAccent() {
  // no-op — accent ownership moved to useChronoTheme
}
