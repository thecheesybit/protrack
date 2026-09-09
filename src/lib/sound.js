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

/* ── Sound bank — event distinctive chimes ──────────────────────────────── */

/**
 * Deep bronze temple bell ("temple bang") — rings on the hour and meditative markers.
 * Synthesizes a warm fundamental with inharmonic partials and long exponential decay.
 */
export function playTempleBell() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const now = ctx.currentTime

    const partials = [
      { ratio: 1.0, gain: 0.32, decay: 3.2 },
      { ratio: 2.76, gain: 0.20, decay: 2.4 },
      { ratio: 5.4, gain: 0.10, decay: 1.6 },
      { ratio: 8.9, gain: 0.04, decay: 0.9 },
    ]

    const baseFreq = 155.56 // D#3 deep bronze tone

    partials.forEach(({ ratio, gain, decay }) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq * ratio, now)

      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(gain, now + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay)

      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + decay)
    })
  } catch (err) {
    console.warn('[sound] temple bell failed', err)
  }
}

/** Crisp double-harmonic rising crystalline chime — todo completion. */
export function playTodoChime() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const now = ctx.currentTime

    const notes = [
      { freq: 783.99, t: 0, gain: 0.18, len: 0.28 },
      { freq: 1046.5, t: 0.08, gain: 0.22, len: 0.4 },
      { freq: 1567.98, t: 0.12, gain: 0.08, len: 0.3 },
    ]

    notes.forEach(({ freq, t, gain, len }) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + t)
      g.gain.setValueAtTime(0, now + t)
      g.gain.linearRampToValueAtTime(gain, now + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0008, now + t + len)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(now + t)
      osc.stop(now + t + len)
    })
  } catch (err) {
    console.warn('[sound] todo chime failed', err)
  }
}

/** Sacred three-tone singing bowl chord — deep focus session completion. */
export function playFocusChime() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const now = ctx.currentTime

    const tones = [
      { freq: 261.63, delay: 0, gain: 0.2, decay: 2.2 }, // C4 root
      { freq: 392.0, delay: 0.15, gain: 0.18, decay: 2.0 }, // G4 fifth
      { freq: 528.0, delay: 0.32, gain: 0.24, decay: 2.5 }, // 528 Hz miracle tone
    ]

    tones.forEach(({ freq, delay, gain, decay }) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      g.gain.setValueAtTime(0, now + delay)
      g.gain.linearRampToValueAtTime(gain, now + delay + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + decay)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + decay)
    })
  } catch (err) {
    console.warn('[sound] focus chime failed', err)
  }
}

/** Gentle two-tone marimba chime — notification and deadline reminders. */
export function playNotificationChime() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    const now = ctx.currentTime

    const tones = [
      { freq: 880, delay: 0, gain: 0.14 },
      { freq: 1318.51, delay: 0.1, gain: 0.16 },
    ]

    tones.forEach(({ freq, delay, gain }) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      g.gain.setValueAtTime(0, now + delay)
      g.gain.linearRampToValueAtTime(gain, now + delay + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0005, now + delay + 0.38)
      osc.connect(g)
      g.connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + 0.4)
    })
  } catch (err) {
    console.warn('[sound] notification chime failed', err)
  }
}

/** Active alarm ringtone state for continuous phone alarm playback */
let activeAlarmTimer = null
let activeAlarmGains = []

function scheduleNote(ctx, freq, startTime, duration = 0.28, gainVal = 0.2) {
  if (!ctx || ctx.state === 'closed') return

  const osc = ctx.createOscillator()
  const oscHarmonic = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, startTime)

  // Subtle 2nd harmonic for bell/marimba brightness
  oscHarmonic.type = 'sine'
  oscHarmonic.frequency.setValueAtTime(freq * 2, startTime)

  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0005, startTime + duration)

  osc.connect(gain)
  oscHarmonic.connect(gain)
  gain.connect(ctx.destination)

  osc.start(startTime)
  oscHarmonic.start(startTime)
  osc.stop(startTime + duration)
  oscHarmonic.stop(startTime + duration)

  activeAlarmGains.push(gain)
}

function scheduleBass(ctx, freq, startTime, duration = 0.5) {
  if (!ctx || ctx.state === 'closed') return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startTime)

  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(startTime)
  osc.stop(startTime + duration)

  activeAlarmGains.push(gain)
}

/** Plays one full phrase of the upbeat smartphone marimba alarm melody (~2.4s) */
function playPhoneAlarmMelody(ctx, startTime) {
  // Bar 1 — Bass E3 + ascending upbeat marimba arpeggio
  scheduleBass(ctx, 164.81, startTime, 0.7)
  scheduleNote(ctx, 659.25, startTime + 0.00, 0.22, 0.22) // E5
  scheduleNote(ctx, 830.61, startTime + 0.12, 0.22, 0.22) // G#5
  scheduleNote(ctx, 987.77, startTime + 0.24, 0.22, 0.24) // B5
  scheduleNote(ctx, 1318.51, startTime + 0.36, 0.28, 0.26) // E6
  scheduleNote(ctx, 1244.51, startTime + 0.50, 0.22, 0.22) // D#6
  scheduleNote(ctx, 987.77, startTime + 0.62, 0.22, 0.22) // B5
  scheduleNote(ctx, 1108.73, startTime + 0.74, 0.24, 0.24) // C#6
  scheduleNote(ctx, 830.61, startTime + 0.86, 0.24, 0.22) // G#5

  // Bar 2 — Bass A3 + energetic melodic flourish
  scheduleBass(ctx, 220.0, startTime + 0.98, 0.7)
  scheduleNote(ctx, 880.00, startTime + 0.98, 0.22, 0.22) // A5
  scheduleNote(ctx, 1108.73, startTime + 1.10, 0.22, 0.24) // C#6
  scheduleNote(ctx, 1318.51, startTime + 1.22, 0.24, 0.26) // E6
  scheduleNote(ctx, 1661.22, startTime + 1.34, 0.30, 0.28) // G#6
  scheduleNote(ctx, 1479.98, startTime + 1.48, 0.22, 0.24) // F#6
  scheduleNote(ctx, 1244.51, startTime + 1.60, 0.22, 0.22) // D#6
  scheduleNote(ctx, 1318.51, startTime + 1.72, 0.28, 0.26) // E6
  scheduleNote(ctx, 987.77, startTime + 1.86, 0.24, 0.22) // B5

  // Bar 3 — Bass B3 + joyful cadence & resolution
  scheduleBass(ctx, 246.94, startTime + 1.98, 0.5)
  scheduleNote(ctx, 830.61, startTime + 1.98, 0.20, 0.20) // G#5
  scheduleNote(ctx, 880.00, startTime + 2.08, 0.20, 0.22) // A5
  scheduleNote(ctx, 987.77, startTime + 2.18, 0.22, 0.24) // B5
  scheduleNote(ctx, 1318.51, startTime + 2.28, 0.35, 0.28) // E6
}

/**
 * Stop active phone alarm ringtone immediately and cleanly.
 */
export function stopAlarmRingtone() {
  if (activeAlarmTimer) {
    clearInterval(activeAlarmTimer)
    activeAlarmTimer = null
  }
  if (activeAlarmGains.length > 0) {
    activeAlarmGains.forEach((g) => {
      try {
        g.gain.cancelScheduledValues(0)
        g.gain.setValueAtTime(0, 0)
      } catch { /* noop */ }
    })
    activeAlarmGains = []
  }
}

/**
 * Start looping phone alarm ringtone (calls phone alarm melody continuously).
 */
export function startAlarmRingtone() {
  if (!soundsEnabled()) return
  stopAlarmRingtone()

  try {
    const ctx = audioCtx()
    playPhoneAlarmMelody(ctx, ctx.currentTime)

    activeAlarmTimer = setInterval(() => {
      if (!soundsEnabled()) {
        stopAlarmRingtone()
        return
      }
      try {
        const c = audioCtx()
        playPhoneAlarmMelody(c, c.currentTime)
      } catch (err) {
        console.warn('[sound] alarm loop tick failed', err)
      }
    }, 2600)
  } catch (err) {
    console.warn('[sound] startAlarmRingtone failed', err)
  }
}

/** Vibrant phone alarm melody — upbeat multi-bar smartphone alarm music. */
export function playAlarmChime() {
  if (!soundsEnabled()) return
  try {
    const ctx = audioCtx()
    playPhoneAlarmMelody(ctx, ctx.currentTime)
  } catch (err) {
    console.warn('[sound] alarm chime failed', err)
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
  temple: playTempleBell,
  todo: playTodoChime,
  focus: playFocusChime,
  notification: playNotificationChime,
  alarm: playAlarmChime,
}

/**
 * Play a named sound from the bank. Unknown or nullish names are a silent
 * no-op, so a caller can forward a "maybe a sound" value straight through.
 * Gated by {@link soundsEnabled} and never throws.
 * @param {'chime'|'pop'|'success'|'habit'|'notify'|'error'|'prompt'|'temple'|'todo'|'focus'|'notification'|'alarm'} name
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
 * `null` means "no sound" (a valid, silent no-op through {@link playSound}).
 * Unlisted kinds (e.g. 'sync-offline', 'info', 'cancelled') fall through to
 * 'notify'.
 * @param {string} kind
 * @returns {'success'|'chime'|'error'|'notify'|null}
 */
export function chimeForIslandKind(kind) {
  switch (kind) {
    case 'success':
    case 'milestone':
    case 'update-ready':
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
    case 'temple':
    case 'hourly':
      return 'temple'
    case 'alarm':
      return 'alarm'
    case 'reminder':
    case 'notification':
      return 'notification'
    // Background auto-update download the user never asked for — stay silent.
    case 'update-downloading':
      return null
    default:
      return 'notify'
  }
}
