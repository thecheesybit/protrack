/**
 * Zero-asset audio via the Web Audio API: a pleasant completion chime and
 * synthesized ambient soundscapes (filtered noise). Works fully offline.
 */
let ctx = null
function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

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

/** Looping, synthesized ambient soundscape. */
export class AmbientPlayer {
  constructor() {
    this.nodes = null
    this.current = 'none'
  }

  start(type) {
    this.stop()
    if (type === 'none' || !type) {
      this.current = 'none'
      return
    }
    const ac = audioCtx()
    const src = ac.createBufferSource()
    src.buffer = makeNoiseBuffer(ac)
    src.loop = true

    const filter = ac.createBiquadFilter()
    const gain = ac.createGain()
    gain.gain.value = 0.0
    gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + 1.5)

    let lfo = null
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
    }

    src.connect(filter).connect(gain).connect(ac.destination)
    src.start()
    this.nodes = { src, gain, lfo }
    this.current = type
  }

  stop() {
    if (!this.nodes) return
    const { src, lfo } = this.nodes
    try {
      src.stop()
      lfo?.stop()
    } catch {
      /* already stopped */
    }
    this.nodes = null
    this.current = 'none'
  }
}
