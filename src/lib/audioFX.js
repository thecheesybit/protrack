const getCtx = () => {
  if (!window._audioCtx) {
    window._audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  return window._audioCtx
}

const isEnabled = () => localStorage.getItem('protrack:sounds') !== 'false'

export function playChime() {
  if (!isEnabled()) return
  const ctx = getCtx()
  if (ctx.state === 'suspended') ctx.resume()
  
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
}

export function playPop() {
  if (!isEnabled()) return
  const ctx = getCtx()
  if (ctx.state === 'suspended') ctx.resume()
  
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
}

export function playSuccess() {
  if (!isEnabled()) return
  const ctx = getCtx()
  if (ctx.state === 'suspended') ctx.resume()
  
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
  
  playNote(523.25, 0)    // C5
  playNote(659.25, 0.1)  // E5
  playNote(783.99, 0.2)  // G5
  playNote(1046.50, 0.3) // C6
}
