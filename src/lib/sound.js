/**
 * Unified sound module — the single WebAudio sound bank for the whole app.
 *
 * Every non-focus sound funnels through here: the four legacy effects
 * (chime / pop / success / habit, ported verbatim from the old audioFX.js so
 * the tones users already know stay identical) plus three new ones
 * (notify / error / prompt) that P4's center prompts and P5's universal
 * chimes build on.
 *
 * Deliberately NOT in scope:
 *   - audioEngine.js keeps its own focus-completion chime + MultiTrackMixer.
 *   - No UI is wired here; no store slice imports this.
 *
 * Flag unification: the canonical "sounds on?" key is `protrack:sounds`. A
 * legacy key (`protrack:sounds_enabled`, still read by audioEngine's
 * playEventSound) is migrated on load and mirrored on every write, so the two
 * can never drift apart again.
 *
 * Pure + defensive: every WebAudio path is wrapped so a missing AudioContext
 * (SSR, tests, locked-down browsers) can never throw into a render path.
 */

const CANONICAL_KEY = 'protrack:sounds'
const LEGACY_KEY = 'protrack:sounds_enabled'

/* ── Enabled flag ─────────────────────────────────────────────────────────── */

/**
 * One-time migration: if the canonical key was never set but the user muted
 * sound under the old key, carry that preference forward. Safe to call
 * repeatedly — it only writes while the canonical key is absent.
 */
export function migrateSoundsFlag() {
  try {
    if (
      localStorage.getItem(CANONICAL_KEY) === null &&
      localStorage.getItem(LEGACY_KEY) === 'false'
    ) {
      localStorage.setItem(CANONICAL_KEY, 'false')
    }
  } catch {
    /* localStorage unavailable — nothing to migrate */
  }
}

/**
 * Whether UI sounds should play. Defaults to on (only an explicit `'false'`
 * mutes), and stays on if storage is unreadable.
 * @returns {boolean}
 */
export function soundsEnabled() {
  try {
    return localStorage.getItem(CANONICAL_KEY) !== 'false'
  } catch {
    return true
  }
}

/**
 * Persist the sounds-on preference. Writes the canonical key and mirrors the
 * legacy key so audioEngine.playEventSound (untouched in this phase) stays in
 * sync — one toggle now governs every sound in the app.
 * @param {boolean} on
 */
export function setSoundsEnabled(on) {
  const value = on ? 'true' : 'false'
  try {
    localStorage.setItem(CANONICAL_KEY, value)
    localStorage.setItem(LEGACY_KEY, value)
  } catch {
    /* localStorage unavailable — preference not persisted */
  }
}

// Migrate once, when the module is first imported.
migrateSoundsFlag()

/* ── WebAudio context ─────────────────────────────────────────────────────── */

let _ctx = null

/** Lazily create (and resume) the shared AudioContext. */
function audioCtx() {
  if (!_ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    _ctx = new Ctor()
  }
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

/* ── Sound bank — legacy four (envelopes verbatim from audioFX.js) ────────── */

/** Short rising sine — generic positive blip. */
export function playChime() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1) // A6

    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch (err) {
    console.warn('[sound] chime failed', err)
  }
}

/** Quick downward blip — item added / lightweight action. */
export function playPop() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1)

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch (err) {
    console.warn('[sound] pop failed', err)
  }
}

/** Ascending C-major arpeggio — task/goal completed. */
export function playSuccess() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()

    const playNote = (freq, delay) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + delay)
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + delay + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.3)
    }

    playNote(523.25, 0) // C5
    playNote(659.25, 0.1) // E5
    playNote(783.99, 0.2) // G5
    playNote(1046.5, 0.3) // C6
  } catch (err) {
    console.warn('[sound] success failed', err)
  }
}

/** Brighter four-note arpeggio — habit ping. */
export function playHabitChime() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()

    const notes = [
      { freq: 587.33, delay: 0 }, // D5
      { freq: 739.99, delay: 0.12 }, // F#5
      { freq: 880.0, delay: 0.24 }, // A5
      { freq: 1174.66, delay: 0.38 }, // D6
    ]

    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
      gain.gain.setValueAtTime(0, ctx.currentTime + delay)
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + delay + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.45)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.45)
    })
  } catch (err) {
    console.warn('[sound] habit chime failed', err)
  }
}

/* ── Sound bank — new three ──────────────────────────────────────────────── */

/** Soft two-tone bell — informational notification. */
export function playNotify() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const now = ctx.currentTime
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.11
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch (err) {
    console.warn('[sound] notify failed', err)
  }
}

/** Low descending tone — something went wrong. */
export function playError() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.25)

    gain.gain.setValueAtTime(0.22, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.4)
  } catch (err) {
    console.warn('[sound] error tone failed', err)
  }
}

/** Gentle rising tone — a center prompt is asking for input. */
export function playPrompt() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(392, now) // G4
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.18) // D5

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.45)
  } catch (err) {
    console.warn('[sound] prompt failed', err)
  }
}

/* ── Dispatch + Island mapping ───────────────────────────────────────────── */

const BANK = {
  chime: playChime,
  pop: playPop,
  success: playSuccess,
  habit: playHabitChime,
  notify: playNotify,
  error: playError,
  prompt: playPrompt,
}

/**
 * Play a named sound from the bank. Unknown or nullish names are a silent
 * no-op, so a caller can forward a "maybe a sound" value straight through.
 * Gated by {@link soundsEnabled} and never throws.
 * @param {'chime'|'pop'|'success'|'habit'|'notify'|'error'|'prompt'} name
 */
export function playSound(name) {
  if (!soundsEnabled()) return
  const fn = BANK[name]
  if (!fn) return
  try {
    fn()
  } catch (err) {
    console.warn('[sound] playSound failed', err)
  }
}

/**
 * Map a Dynamic Island event `kind` to the sound that should accompany it.
 * Returns the sound name only — the caller (P5's useIslandCycle) plays it.
 * Unlisted kinds (e.g. 'sync-offline', 'info') fall through to 'notify'.
 * @param {string} kind
 * @returns {'success'|'chime'|'error'|'notify'}
 */
export function chimeForIslandKind(kind) {
  switch (kind) {
    case 'success':
      return 'success'
    case 'progress':
    case 'water':
    case 'sync-online':
    case 'focus':
    case 'break':
      return 'chime'
    case 'deadline':
    case 'error':
      return 'error'
    default:
      return 'notify'
  }
}
