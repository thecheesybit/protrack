/**
 * Universal "Dynamic Island" notifier state. Holds an active event plus a FIFO
 * queue; the visual morph + auto-dismiss timers live in useIslandCycle and the
 * DynamicIsland component, so this slice stays pure and trivially testable.
 *
 * Every status surface in the app (Pomodoro alerts, water reminders, sync
 * states, Kanban progress) funnels through pushIsland — one canonical notifier,
 * no scattered toasts, zero emojis (Lucide iconography only).
 *
 * @typedef {Object} IslandEvent
 * @property {number}  id        Monotonic, assigned internally.
 * @property {string}  kind      'focus'|'break'|'water'|'sync-offline'|'sync-online'|'progress'|'success'|'info'
 * @property {string}  title     Primary line.
 * @property {?string} detail    Optional secondary line.
 * @property {?number} progress  0-100 to render a slim progress bar, else null.
 * @property {?number} duration  ms before auto-advance; null = sticky.
 * @property {boolean} sticky    Stays until explicitly dismissed.
 */

// Module-scoped counter keeps ids stable without Date.now()/Math.random().
let _islandId = 0
const nextIslandId = () => (_islandId += 1)

const DEFAULT_DURATION = 3800

export const createIslandSlice = (set) => ({
  islandActive: null, // IslandEvent | null
  islandQueue: [], // IslandEvent[]

  /**
   * Enqueue a status event. Returns its id so callers can later update/dismiss
   * a long-lived event (e.g. an offline banner or a live download).
   * @param {Partial<IslandEvent>} event
   * @returns {number}
   */
  pushIsland: (event) => {
    const item = {
      id: nextIslandId(),
      kind: event.kind || 'info',
      title: event.title || '',
      detail: event.detail || null,
      progress: typeof event.progress === 'number' ? event.progress : null,
      sticky: Boolean(event.sticky),
      duration: event.sticky ? null : event.duration ?? DEFAULT_DURATION,
    }
    set((s) =>
      s.islandActive
        ? { islandQueue: [...s.islandQueue, item] }
        : { islandActive: item },
    )
    return item.id
  },

  /** Promote the next queued event (called by useIslandCycle on expiry). */
  advanceIsland: () =>
    set((s) => {
      const [next = null, ...rest] = s.islandQueue
      return { islandActive: next, islandQueue: rest }
    }),

  /** Dismiss a specific event whether it is active or still queued. */
  dismissIsland: (id) =>
    set((s) => {
      if (s.islandActive && s.islandActive.id === id) {
        const [next = null, ...rest] = s.islandQueue
        return { islandActive: next, islandQueue: rest }
      }
      return { islandQueue: s.islandQueue.filter((e) => e.id !== id) }
    }),

  /** Patch an in-flight event immutably (e.g. live progress updates). */
  updateIsland: (id, patch) =>
    set((s) => {
      if (s.islandActive && s.islandActive.id === id) {
        return { islandActive: { ...s.islandActive, ...patch } }
      }
      return {
        islandQueue: s.islandQueue.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }
    }),

  clearIsland: () => set({ islandActive: null, islandQueue: [] }),
})
