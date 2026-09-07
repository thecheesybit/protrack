/**
 * Blocking center-prompt queue. Any prompt that needs an answer — a daily
 * check-in, a routine/habit cue, an idle quote — becomes the single
 * `activePrompt`; anything raised while one is showing waits in `promptQueue`
 * (FIFO). Only ever one on screen, so a quote and a check-in can never stack.
 *
 * The blur-overlay shell, Esc/✕ handling, focus-trap and open chime live in
 * CenterPrompt.jsx (check-in + routine) and ZenOverlay.jsx (quotes) — this
 * slice stays pure: no timers, no I/O, no side-effects.
 *
 * @typedef {Object} Prompt
 * @property {number}  id           Monotonic, assigned internally.
 * @property {'checkin'|'routine'|'quote'} type
 * @property {*}       payload      Type-specific data (question, habit, …).
 * @property {?number} snoozeMs     How long an unanswered dismissal should
 *                                  snooze this prompt's source. The source
 *                                  hook owns the actual snooze write; this is
 *                                  just carried through for it to read.
 * @property {boolean} dismissible  Whether Esc/✕ may close it (default true).
 * @property {?string} coalesceKey  When set, a later push with the same key
 *                                  folds onto the prompt already active/queued
 *                                  (refreshing its payload) instead of stacking
 *                                  a duplicate. Used so one habit re-firing on
 *                                  its interval never dogpiles the queue.
 */

// Module-scoped counter keeps ids stable without Date.now()/Math.random().
let _promptId = 0
const nextPromptId = () => (_promptId += 1)

export const createPromptSlice = (set, get) => ({
  activePrompt: null, // Prompt | null
  promptQueue: [], // Prompt[]

  /**
   * Enqueue a prompt. Becomes active immediately when nothing is showing,
   * otherwise waits its turn behind the current one. A `coalesceKey` folds a
   * repeat push from the same source onto the prompt already active/queued
   * (refreshing payload/snoozeMs) rather than stacking a duplicate.
   * @param {Partial<Prompt>} prompt
   * @returns {number} the id of the active/queued prompt for this push
   */
  pushPrompt: (prompt) => {
    const coalesceKey = prompt.coalesceKey ?? null
    if (coalesceKey) {
      const { activePrompt, promptQueue } = get()
      if (activePrompt?.coalesceKey === coalesceKey) return activePrompt.id
      const queued = promptQueue.find((p) => p.coalesceKey === coalesceKey)
      if (queued) {
        const merged = {
          ...queued,
          payload: prompt.payload ?? queued.payload,
          snoozeMs:
            typeof prompt.snoozeMs === 'number' ? prompt.snoozeMs : queued.snoozeMs,
        }
        set((s) => ({
          promptQueue: s.promptQueue.map((p) =>
            p.coalesceKey === coalesceKey ? merged : p,
          ),
        }))
        return merged.id
      }
    }
    const item = {
      id: nextPromptId(),
      type: prompt.type || 'checkin',
      payload: prompt.payload ?? null,
      snoozeMs: typeof prompt.snoozeMs === 'number' ? prompt.snoozeMs : null,
      dismissible: prompt.dismissible !== false,
      coalesceKey,
    }
    set((s) =>
      s.activePrompt
        ? { promptQueue: [...s.promptQueue, item] }
        : { activePrompt: item },
    )
    return item.id
  },

  /** Answered — advance to the next queued prompt. */
  resolvePrompt: () =>
    set((s) => {
      const [next = null, ...rest] = s.promptQueue
      return { activePrompt: next, promptQueue: rest }
    }),

  /**
   * Unanswered dismissal. Same queue advance as resolvePrompt — the caller
   * runs the source-specific snooze (snoozeCheckins, habit re-arm, …) using
   * the active prompt's `snoozeMs` before calling this.
   */
  snoozePrompt: () =>
    set((s) => {
      const [next = null, ...rest] = s.promptQueue
      return { activePrompt: next, promptQueue: rest }
    }),

  /** Drop a specific prompt whether it is active or still queued. */
  dismissPrompt: (id) =>
    set((s) => {
      if (s.activePrompt && s.activePrompt.id === id) {
        const [next = null, ...rest] = s.promptQueue
        return { activePrompt: next, promptQueue: rest }
      }
      return { promptQueue: s.promptQueue.filter((p) => p.id !== id) }
    }),

  clearPrompts: () => set({ activePrompt: null, promptQueue: [] }),
})
