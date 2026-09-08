/**
 * Compatibility shim. The sound bank moved to ./sound.js as part of the
 * unified-audio work (P0); this file stays only so existing importers
 * (SessionCompleteModal, TodosWidget, NotesWidget, MicroKanban,
 * useHabitReminders, TimeContextPanel) keep working untouched.
 *
 * New code should import from ./sound.js directly and prefer `playSound(name)`.
 */
export { playChime, playPop, playSuccess, playHabitChime } from './sound'
