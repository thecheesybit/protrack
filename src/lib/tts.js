/**
 * Single tiered text-to-speech utility. Replaces the copy-pasted speak logic
 * that used to live in HandsFreeTab, BackgroundHandsFree and ZenOverlay.
 *
 *   Tier 1  ElevenLabs   — if getElevenLabsKey() (eleven_multilingual_v2, Rachel)
 *   Tier 2  OpenAI TTS    — if getOpenAIKey()    (gpt-4o-mini-tts, "alloy")
 *   Tier 3  Web Speech    — the most natural installed voice, rate/pitch ~1.0
 *
 * Every tier degrades gracefully: a missing key, a network error, or an
 * unavailable synth falls through to the next tier and finally to a silent
 * no-op that still fires `onEnd` — it must never throw into a render path.
 *
 * Provider order can be pinned in Settings (getProviderPreference); the Web
 * Speech voice can be pinned too (getVoicePreference). Both live in localStorage.
 */
import { getElevenLabsKey, getOpenAIKey } from '@/services/geminiService'

const VOICE_PREF_KEY = 'protrack:tts_voice' // stored voiceURI (or name)
const PROVIDER_PREF_KEY = 'protrack:tts_provider' // 'auto' | 'elevenlabs' | 'openai' | 'web'

const ELEVEN_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel — calm, natural
const OPENAI_VOICE = 'alloy'

// Module-scoped playback handles so stopSpeaking() can interrupt any tier.
let activeAudio = null
let activeUtterance = null
let fadeTimer = null
let voiceCache = null

/* ── preferences (localStorage, all wrapped) ─────────────── */

export function getVoicePreference() {
  try {
    return localStorage.getItem(VOICE_PREF_KEY) || ''
  } catch {
    return ''
  }
}
export function setVoicePreference(voiceURIorName) {
  try {
    if (voiceURIorName) localStorage.setItem(VOICE_PREF_KEY, voiceURIorName)
    else localStorage.removeItem(VOICE_PREF_KEY)
  } catch {
    /* private mode — preference just won't persist */
  }
}
export function getProviderPreference() {
  try {
    return localStorage.getItem(PROVIDER_PREF_KEY) || 'auto'
  } catch {
    return 'auto'
  }
}
export function setProviderPreference(p) {
  try {
    localStorage.setItem(PROVIDER_PREF_KEY, p || 'auto')
  } catch {
    /* private mode */
  }
}

/* ── Web Speech voice selection ──────────────────────────── */

/** All installed SpeechSynthesis voices, cached; also warms on `voiceschanged`. */
export function listVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  const v = window.speechSynthesis.getVoices() || []
  if (v.length) voiceCache = v
  return voiceCache || v
}

/** Ask the engine to load voices and cache them once they arrive (async on some OSes). */
export function primeVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  listVoices()
  const handler = () => {
    voiceCache = window.speechSynthesis.getVoices() || voiceCache
  }
  try {
    window.speechSynthesis.addEventListener('voiceschanged', handler, { once: true })
  } catch {
    window.speechSynthesis.onvoiceschanged = handler
  }
}

const NEURAL_RE = /natural|neural|online|premium|enhanced|wavenet|studio/i
const NAMED_RE = /aria|jenny|guy|libby|ryan|sonia|michelle|nova|ava|emma|google|siri/i
const ROBOTIC_RE = /espeak|festival|compact|robo|pico|flite/i

/** Score a voice for naturalness against a target BCP-47 language. */
function scoreVoice(voice, lang) {
  const base = (lang || 'en').toLowerCase().split('-')[0]
  if (!voice.lang || !voice.lang.toLowerCase().startsWith(base)) return -Infinity
  let score = 0
  if (NEURAL_RE.test(voice.name)) score += 100
  if (NAMED_RE.test(voice.name)) score += 40
  if (voice.localService === false) score += 15 // network voices tend to be richer
  if (voice.default) score += 10
  if (voice.lang.toLowerCase() === (lang || '').toLowerCase()) score += 5
  if (ROBOTIC_RE.test(voice.name)) score -= 40
  return score
}

/**
 * Best available Web Speech voice for `lang`. A stored preference wins when it
 * matches an installed voice; otherwise the highest naturalness score.
 * @returns {SpeechSynthesisVoice | null}
 */
export function getPreferredVoice(lang = 'en-US') {
  const voices = listVoices()
  if (!voices.length) return null

  const pref = getVoicePreference()
  if (pref) {
    const hit = voices.find((v) => v.voiceURI === pref || v.name === pref)
    if (hit) return hit
  }

  let best = null
  let bestScore = -Infinity
  for (const v of voices) {
    const s = scoreVoice(v, lang)
    if (s > bestScore) {
      bestScore = s
      best = v
    }
  }
  if (best && bestScore > -Infinity) return best
  return voices.find((v) => v.default) || voices[0] || null
}

/* ── stop ────────────────────────────────────────────────── */

function clearFade() {
  if (fadeTimer) {
    clearInterval(fadeTimer)
    fadeTimer = null
  }
}

function teardownAudio(audio) {
  if (!audio) return
  try {
    audio.pause()
  } catch {
    /* noop */
  }
  if (audio.src && audio.src.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(audio.src)
    } catch {
      /* noop */
    }
  }
}

/** Interrupt any in-flight speech (all tiers). `fade` ramps audio out ~350ms. */
export function stopSpeaking({ fade = false } = {}) {
  clearFade()
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* noop */
    }
  }
  activeUtterance = null

  const audio = activeAudio
  activeAudio = null
  if (!audio) return

  if (fade && audio.volume > 0.05) {
    let vol = audio.volume
    fadeTimer = setInterval(() => {
      vol -= 0.1
      if (vol > 0.05) {
        audio.volume = Math.max(0, vol)
      } else {
        clearFade()
        teardownAudio(audio)
      }
    }, 35)
  } else {
    teardownAudio(audio)
  }
}

/* ── remote-provider tiers (return true on success) ──────── */

async function playBlob(blob, { volume, onStart, onEnd }) {
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.volume = volume
  activeAudio = audio
  audio.onplay = () => onStart?.()
  const done = () => {
    if (audio.src && audio.src.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(audio.src)
      } catch {
        /* noop */
      }
    }
    if (activeAudio === audio) activeAudio = null
    onEnd?.()
  }
  audio.onended = done
  audio.onerror = done
  await audio.play()
}

async function speakElevenLabs(text, opts) {
  const key = getElevenLabsKey()
  if (!key) return false
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.8, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`)
  await playBlob(await res.blob(), opts)
  return true
}

async function speakOpenAI(text, opts) {
  const key = getOpenAIKey()
  if (!key) return false
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: OPENAI_VOICE,
      input: text,
      response_format: 'mp3',
    }),
  })
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}`)
  await playBlob(await res.blob(), opts)
  return true
}

function speakWebSpeech(text, { lang, rate, pitch, volume, onStart, onEnd }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.()
    return false
  }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = rate
  u.pitch = pitch
  u.volume = volume
  const voice = getPreferredVoice(lang)
  if (voice) u.voice = voice
  u.onstart = () => onStart?.()
  u.onend = () => {
    if (activeUtterance === u) activeUtterance = null
    onEnd?.()
  }
  u.onerror = () => {
    if (activeUtterance === u) activeUtterance = null
    onEnd?.()
  }
  activeUtterance = u
  window.speechSynthesis.speak(u)
  return true
}

/** Ordered tier list honouring the stored provider preference. */
export function tierOrder(pref = getProviderPreference()) {
  switch (pref) {
    case 'elevenlabs':
      return ['elevenlabs', 'web']
    case 'openai':
      return ['openai', 'web']
    case 'web':
      return ['web']
    default:
      return ['elevenlabs', 'openai', 'web']
  }
}

/* ── public speak() ─────────────────────────────────────── */

/**
 * Speak `text` through the best available tier.
 * @param {string} text
 * @param {object} [opts]
 * @param {string}  [opts.lang='en-US']
 * @param {boolean} [opts.voiceEnabled=true] when false, resolves immediately (still calls onEnd)
 * @param {number}  [opts.rate=1.0]   Web Speech rate  (natural ≈ 1.0, not 0.85)
 * @param {number}  [opts.pitch=1.0]  Web Speech pitch (natural ≈ 1.0, not 0.9)
 * @param {number}  [opts.volume=0.9]
 * @param {() => void} [opts.onStart]
 * @param {() => void} [opts.onEnd]
 * @returns {Promise<void>}
 */
export async function speak(text, opts = {}) {
  const {
    lang = 'en-US',
    voiceEnabled = true,
    rate = 1.0,
    pitch = 1.0,
    volume = 0.9,
    onStart,
    onEnd,
  } = opts

  const clean = String(text || '').replace(/\s*\n\s*/g, ' ').trim()
  if (!voiceEnabled || !clean) {
    onEnd?.()
    return
  }

  stopSpeaking()
  const playOpts = { lang, rate, pitch, volume, onStart, onEnd }

  for (const tier of tierOrder()) {
    try {
      if (tier === 'elevenlabs' && (await speakElevenLabs(clean, playOpts))) return
      if (tier === 'openai' && (await speakOpenAI(clean, playOpts))) return
      if (tier === 'web') {
        speakWebSpeech(clean, playOpts)
        return
      }
    } catch (err) {
      console.warn(`[tts] ${tier} failed, trying next tier`, err)
    }
  }
  // Nothing spoke — keep any caller loop alive.
  onEnd?.()
}
