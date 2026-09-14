/**
 * Crash-proof Deep Focus session persistence.
 *
 * Ephemeral, same-device, crash-recovery-only state — deliberately localStorage,
 * never Firestore (Free-tier discipline rule 1: ephemeral/derived state stays
 * local). useFocusEngine writes a snapshot on every start/pause/resume/phase
 * change plus every 60 ticks (minute-by-minute), and best-effort on
 * `beforeunload`; useFocusRecovery reads it once on boot.
 *
 * @typedef {Object} FocusSnapshot
 * @property {'idle'|'running'|'paused'} status
 * @property {'focus'|'break'} phase
 * @property {object|null} session
 * @property {number|null} startedAt
 * @property {number} phaseTotalSec
 * @property {number} secondsLeft
 * @property {{work:number, break:number}} customTimerSetting
 * @property {number} savedAt  Wall-clock ms when this snapshot was written.
 */

const STORAGE_KEY = 'protrack:focus:snapshot_v1'

/** @param {Partial<FocusSnapshot>} snapshot */
export function saveFocusSnapshot(snapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }))
  } catch {
    // localStorage unavailable (private mode, quota) — crash recovery just won't have data
  }
}

/** @returns {FocusSnapshot | null} */
export function readFocusSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function clearFocusSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

/**
 * True when a pending `resumableSession` snapshot belongs to the exact
 * calendar slot or todo the user just clicked "Start Focus" on — the signal
 * the three start-focus entry points (FocusPanel, TimeContextPanel,
 * TodosWidget) use to resume instead of starting a fresh session.
 * @param {FocusSnapshot | null} resumableSession
 * @param {{ slotId?: string|null, todoId?: string|null }} target
 */
export function resumableSessionMatches(resumableSession, { slotId, todoId } = {}) {
  const session = resumableSession?.session
  if (!session) return false
  if (todoId && session.todoId === todoId) return true
  if (slotId && session.slotId === slotId) return true
  return false
}
