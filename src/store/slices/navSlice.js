/**
 * navSlice — cross-module navigation / context bus  (Phase P7)
 * ===========================================================
 * One canonical channel for "open another module, pointed at this item".
 * Before P7 the only cross-module deep-link was `uiSlice.openFocus`; this slice
 * generalises that idea so any widget can hand context to any other widget
 * without prop-drilling or routing. Pure: no timers, no I/O, no side-effects —
 * the visible board reaction (maximise + prop pass-through + Back button) lives
 * in `BoardCanvas.jsx`, exactly like the other queue slices.
 *
 * ── moduleContext shape ─────────────────────────────────────────────────────
 *   null | {
 *     widgetId : string        registry id — 'timetable' | 'todos' | 'habits' |
 *                              'focus' | 'notes' | 'subjects' | 'analytics' | 'ledger'
 *     itemType : string|null   free-form hint: 'todo'|'task'|'subject'|'slot'|
 *                              'note'|'session'|'tag'|'date' (P8 widgets switch on it)
 *     itemId   : string|null   the id a P8 widget should scroll-to / highlight
 *     subjectId: string|null   optional subject scoping
 *     date     : string|null   optional 'YYYY-MM-DD' scoping (e.g. open Timetable on a day)
 *     tag      : string|null   optional normalized tag to pre-filter by (see lib/tags.js)
 *     activate : boolean       true  → BoardCanvas maximises widgetId and passes
 *                                      moduleContext down as the `context` prop.
 *                              false → context is recorded only; the board is left
 *                                      untouched (used by openFocus so its overlay
 *                                      keeps driving the visible UI unchanged).
 *     seq      : number        monotonic; changes on every openModule / navBack so
 *                              a consuming useEffect can dedupe / re-trigger.
 *   }
 *
 * ── contract for P8 ────────────────────────────────────────────────────────
 *   openModule(widgetId, context = {})
 *     Records context (only the known keys above are kept; `activate` defaults
 *     to true) and pushes the *previous* moduleContext onto navStack, bounded to
 *     the last NAV_STACK_MAX entries. A widget reads the `context` prop
 *     BoardCanvas passes it and, when `context.itemId` matches one of its rows,
 *     scrolls it into view / flashes a highlight.
 *   clearModuleContext()  → moduleContext = null (navStack left intact).
 *   navBack()             → pop navStack, restore that moduleContext (BoardCanvas
 *                           re-reacts via `seq`); clears context when the stack
 *                           is empty.
 *
 * `uiSlice.openFocus` delegates here as
 *   openModule('focus', { itemType, itemId, subjectId, activate: false })
 * so the Focus deep-link now also records which subject/slot it came from,
 * while `FocusPanel` keeps rendering off the unchanged `uiSlice.focusContext`.
 */

// Keep the back-stack tiny — this is a convenience trail, not full history.
export const NAV_STACK_MAX = 10

// Module-scoped counter → stable, monotonic `seq` without Date.now()/Math.random().
let _navSeq = 0
const nextNavSeq = () => (_navSeq += 1)

/** Normalise a raw context bag into the fixed moduleContext shape. */
function shapeContext(widgetId, context) {
  return {
    widgetId,
    itemType: context.itemType ?? null,
    itemId: context.itemId ?? null,
    subjectId: context.subjectId ?? null,
    date: context.date ?? null,
    tag: context.tag ?? null,
    activate: context.activate !== false, // default true
    seq: nextNavSeq(),
  }
}

export const createNavSlice = (set) => ({
  moduleContext: null, // see shape above
  navStack: [], // previous moduleContext values, newest last, bounded to NAV_STACK_MAX

  /**
   * Point a module at an item. Sets `moduleContext` and pushes the prior context
   * onto the bounded back-stack. No-op when `widgetId` is falsy.
   * @param {string} widgetId
   * @param {{itemType?:string,itemId?:string,subjectId?:string,date?:string,tag?:string,activate?:boolean}} [context]
   */
  openModule: (widgetId, context = {}) => {
    if (!widgetId) return
    const next = shapeContext(widgetId, context || {})
    set((s) => ({
      moduleContext: next,
      navStack: [...s.navStack, s.moduleContext].filter(Boolean).slice(-NAV_STACK_MAX),
    }))
  },

  /** Drop the active context without disturbing the back-stack. */
  clearModuleContext: () => set({ moduleContext: null }),

  /**
   * Step back to the previously-open module context. Clears the context when the
   * stack is exhausted. BoardCanvas re-reacts because the restored object keeps
   * its original (now-stale) `seq`, which differs from the last one it saw.
   */
  navBack: () =>
    set((s) => {
      if (!s.navStack.length) {
        return s.moduleContext ? { moduleContext: null } : {}
      }
      const navStack = s.navStack.slice(0, -1)
      const moduleContext = s.navStack[s.navStack.length - 1]
      return { moduleContext, navStack }
    }),
})
