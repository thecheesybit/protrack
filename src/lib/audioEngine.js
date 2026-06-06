/**
 * Zero-asset audio via the Web Audio API: completion chime, event chimes,
 * and synthesized ambient soundscapes (filtered noise). Works fully offline.
 */
let ctx = null
function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/* ── Chimes & Event Sounds ────────────────────────────────────── */

/** Three-note arpeggio to mark a completed session. */
export function playChime() {
  try {
    const ac = audioCtx()
    const now = ac.currentTime
    const notes = [523.25, 659.25, 783.99] // C5 E5 G5
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.16
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(gain).connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    })
  } catch (err) {
    console.warn('[audio] chime failed', err)
  }
}

/**
 * Event-specific sound effects for UI interactions.
 * Each produces a short, distinctive tone. All are safe to fire rapidly.
 */
export function playEventSound(event) {
  try {
    // Respect the global sounds-off preference
    if (localStorage.getItem('protrack:sounds_enabled') === 'false') return
    const ac = audioCtx()
    const now = ac.currentTime
    const SOUNDS = {
      // Soft pop — task/todo added
      add: () => {
        const osc = ac.createOscillator()
        const g = ac.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, now)
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08)
        g.gain.setValueAtTime(0.15, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
        osc.connect(g).connect(ac.destination)
        osc.start(now)
        osc.stop(now + 0.25)
      },
      // Rising ding — task completed / todo checked
      complete: () => {
        const osc = ac.createOscillator()
        const g = ac.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(660, now)
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.15)
        g.gain.setValueAtTime(0.18, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
        osc.connect(g).connect(ac.destination)
        osc.start(now)
        osc.stop(now + 0.4)
      },
      // Short click — drag drop / reorder
      drop: () => {
        const osc = ac.createOscillator()
        const g = ac.createGain()
        osc.type = 'square'
        osc.frequency.value = 400
        g.gain.setValueAtTime(0.08, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
        osc.connect(g).connect(ac.destination)
        osc.start(now)
        osc.stop(now + 0.08)
      },
      // Descending tone — delete / error
      remove: () => {
        const osc = ac.createOscillator()
        const g = ac.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(660, now)
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.15)
        g.gain.setValueAtTime(0.12, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.connect(g).connect(ac.destination)
        osc.start(now)
        osc.stop(now + 0.3)
      },
      // Gentle bell — notification / alert
      notify: () => {
        ;[1046.5, 1318.5].forEach((freq, i) => {
          const osc = ac.createOscillator()
          const g = ac.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq
          const t = now + i * 0.12
          g.gain.setValueAtTime(0, t)
          g.gain.linearRampToValueAtTime(0.15, t + 0.01)
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
          osc.connect(g).connect(ac.destination)
          osc.start(t)
          osc.stop(t + 0.45)
        })
      },
      // Quick tick — toggle / switch
      tick: () => {
        const osc = ac.createOscillator()
        const g = ac.createGain()
        osc.type = 'sine'
        osc.frequency.value = 1000
        g.gain.setValueAtTime(0.1, now)
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
        osc.connect(g).connect(ac.destination)
        osc.start(now)
        osc.stop(now + 0.07)
      },
    }
    const fn = SOUNDS[event]
    if (fn) fn()
  } catch (err) {
    console.warn('[audio] event sound failed', err)
  }
}

/* ── Ambient Soundscapes ──────────────────────────────────────── */

function makeNoiseBuffer(ac) {
  const buffer = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02 // brown-ish noise
    data[i] = last * 3.5
  }
  return buffer
}

/** Looping, synthesized ambient soundscape with volume control. */
export class AmbientPlayer {
  constructor() {
    this.nodes = null
    this.current = 'none'
    this._masterGain = null
    this._volume = 0.5
  }

  start(type) {
    this.stop()
    if (type === 'none' || !type) {
      this.current = 'none'
      return
    }
    const ac = audioCtx()

    // Binaural beats use oscillators, not noise
    if (type === 'binaural') {
      this._startBinaural(ac)
      return
    }

    const src = ac.createBufferSource()
    src.buffer = makeNoiseBuffer(ac)
    src.loop = true

    const filter = ac.createBiquadFilter()
    const gain = ac.createGain()
    gain.gain.value = 0.0

    const masterGain = ac.createGain()
    masterGain.gain.value = this._volume
    this._masterGain = masterGain

    const peakVolume = 0.18
    gain.gain.linearRampToValueAtTime(peakVolume, ac.currentTime + 1.5)

    let lfo = null
    let secondary = null

    if (type === 'rain') {
      filter.type = 'lowpass'
      filter.frequency.value = 1800
    } else if (type === 'wind') {
      filter.type = 'bandpass'
      filter.frequency.value = 600
      filter.Q.value = 0.8
    } else if (type === 'waves') {
      filter.type = 'lowpass'
      filter.frequency.value = 900
      // slow swell for waves
      lfo = ac.createOscillator()
      const lfoGain = ac.createGain()
      lfo.frequency.value = 0.12
      lfoGain.gain.value = 0.12
      lfo.connect(lfoGain).connect(gain.gain)
      lfo.start()
    } else if (type === 'whitenoise') {
      filter.type = 'allpass'
      filter.frequency.value = 1000
    } else if (type === 'cafe') {
      filter.type = 'bandpass'
      filter.frequency.value = 1200
      filter.Q.value = 0.3
      // crackle layer — second noise source at low volume
      secondary = ac.createBufferSource()
      secondary.buffer = makeNoiseBuffer(ac)
      secondary.loop = true
      const crackleFilter = ac.createBiquadFilter()
      crackleFilter.type = 'highpass'
      crackleFilter.frequency.value = 3000
      const crackleGain = ac.createGain()
      crackleGain.gain.value = 0.04
      secondary.connect(crackleFilter).connect(crackleGain).connect(masterGain)
      secondary.start()
    } else if (type === 'forest') {
      filter.type = 'bandpass'
      filter.frequency.value = 700
      filter.Q.value = 0.4
      // birdsong-like chirp modulation
      lfo = ac.createOscillator()
      const lfoGain = ac.createGain()
      lfo.type = 'sine'
      lfo.frequency.value = 4.0
      lfoGain.gain.value = 0.06
      lfo.connect(lfoGain).connect(gain.gain)
      lfo.start()
    }

    src.connect(filter).connect(gain).connect(masterGain).connect(ac.destination)
    src.start()
    this.nodes = { src, gain, lfo, secondary }
    this.current = type
  }

  _startBinaural(ac) {
    const masterGain = ac.createGain()
    masterGain.gain.value = this._volume
    this._masterGain = masterGain

    const gain = ac.createGain()
    gain.gain.value = 0.0
    gain.gain.linearRampToValueAtTime(0.14, ac.currentTime + 1.5)

    // Two oscillators at slightly different frequencies → 10Hz alpha beat
    const oscL = ac.createOscillator()
    const oscR = ac.createOscillator()
    oscL.type = 'sine'
    oscR.type = 'sine'
    oscL.frequency.value = 200
    oscR.frequency.value = 210

    const merger = ac.createChannelMerger(2)
    oscL.connect(merger, 0, 0) // left channel
    oscR.connect(merger, 0, 1) // right channel
    merger.connect(gain).connect(masterGain).connect(ac.destination)

    oscL.start()
    oscR.start()
    this.nodes = { src: oscL, gain, lfo: oscR, secondary: null }
    this.current = 'binaural'
  }

  stop() {
    if (!this.nodes) return
    const { src, lfo, secondary } = this.nodes
    try {
      src.stop()
      lfo?.stop()
      secondary?.stop()
    } catch {
      /* already stopped */
    }
    this.nodes = null
    this._masterGain = null
    this.current = 'none'
  }

  /** Set master volume (0.0–1.0). Can be called while playing. */
  setGain(value) {
    this._volume = Math.max(0, Math.min(1, value))
    if (this._masterGain) {
      this._masterGain.gain.value = this._volume
    }
  }

  getGain() {
    return this._volume
  }
}
