import { useCallback, useEffect, useRef } from 'react'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { chatWithGemini } from '@/services/geminiService'
import { speak, stopSpeaking } from '@/lib/tts'
import { buildVoiceContext } from '@/lib/voiceContext'
import {
  playWakeChime,
  playListeningChime,
  playThinkingChime,
  playSleepChime,
} from '@/lib/sound'

/**
 * useVoiceAgent — the single voice state machine shared by the in-panel
 * Hands-Free tab and the always-on ambient listener.
 *
 *   idle ─(wake word / start)→ listening ─(silence)→ thinking ─→ speaking ─┐
 *     ▲                                                                     │
 *     └───────────────────── (dismiss/idle limit) ◄── listening ◄──────────┘
 *
 * Designed to behave like Alexa:
 *  • Interactive multi-turn dialogue with memory across turns.
 *  • Audio earcons (wake, listening, thinking, sleep) so you don't need to look at the screen.
 *  • Voice barge-in (interruption) using echo-cancelled microphone input.
 *  • Semantic preservation of short conversational replies ("yes", "no", "ok", "sure").
 *  • Instant trailing wake-command dispatch ("Hey Track, what's due today?").
 *  • Hands-free exit / dismissal via voice ("That's all, thanks Track").
 */

const HESITATIONS = ['uh', 'um', 'ah', 'er', 'eh', 'hm', 'hmm', 'mhm', 'shh', 'psst']
const SHORT_VALID_WORDS = new Set([
  'no', 'ok', 'hi', 'go', 'up', 'on', 'do', 'me', 'my', 'in', 'at', 'to', 'ya', 'ha',
])

const INTERRUPT_PATTERN =
  /\b(stop|cancel|wait|pause|quiet|shut\s*up|nevermind|hey\s*track|track|hold\s*on|hush)\b/i

export function isNoise(text) {
  const clean = String(text || '')
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
  if (!clean) return true
  const words = clean.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  if (words.length === 1 && clean.length < 3 && !SHORT_VALID_WORDS.has(words[0])) return true
  return words.every((w) => HESITATIONS.includes(w))
}

export function buildWakeRegex(phrase) {
  if (!phrase) return null
  const escaped = phrase.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match wake phrase anywhere at start with optional "hey/ok/okay" or leading syllables
  return new RegExp(
    `(?:^|.*?\\b)(?:hey\\s+|ok\\s+|okay\\s+)?${escaped}\\b[,.!?:\\s]*(.*)$`,
    'i',
  )
}

export function useVoiceAgent(opts) {
  // `active`, `status`, `wakeWord`, `suppressed` and `idleMs` are read directly
  // in effect dependency lists. Everything else (setActive/setStatus/callbacks/
  // voiceEnabled/turnLimit) is read through `optsRef.current` inside the once-
  // bound async callbacks so they always see fresh values.
  const {
    active,
    status,
    snapshot,
    wakeWord = '',
    suppressed = false,
    idleMs = 30000,
  } = opts

  const {
    listening,
    transcript,
    interim,
    error: speechError,
    transcribing,
    start,
    stop,
    reset: resetSpeech,
    isFallback,
    speechActive,
  } = useSpeechRecognition()

  // Latest-value refs so the once-bound async callbacks read fresh state.
  const snapshotRef = useRef(snapshot)
  const activeRef = useRef(active)
  const statusRef = useRef(status)
  const spokenRef = useRef('')
  const silenceTimerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())
  const turnsRef = useRef(0)
  const historyRef = useRef([]) // [{ role:'user'|'assistant', text }]
  const optsRef = useRef(opts)
  const isDismissingRef = useRef(false)

  useEffect(() => { snapshotRef.current = snapshot }, [snapshot])
  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { optsRef.current = opts })

  // Reset per-session bookkeeping whenever a conversation ends.
  useEffect(() => {
    if (!active) {
      turnsRef.current = 0
      historyRef.current = []
      spokenRef.current = ''
      isDismissingRef.current = false
    }
  }, [active])

  // Track real voice activity for the idle auto-pause.
  useEffect(() => {
    if (transcript || interim || speechActive) lastActivityRef.current = Date.now()
  }, [transcript, interim, speechActive])

  // Surface live listening transcript to caller feedback
  useEffect(() => {
    if (active && status === 'listening') {
      const live = (spokenRef.current + ' ' + (interim || '')).trim()
      if (live) {
        optsRef.current.onFeedback?.({
          userText: live,
          replyText: '',
          isInterim: true,
        })
      }
    }
  }, [active, status, interim])

  /* ── the core turn: text → LLM (with memory) → speak → loop ── */
  const submitText = useCallback(
    async (raw) => {
      const command = String(raw || '').trim()
      const o = optsRef.current
      if (!command || statusRef.current === 'thinking') return

      if (isNoise(command)) {
        spokenRef.current = ''
        if (activeRef.current) {
          o.setStatus('listening')
          start()
        }
        return
      }

      stop()
      playThinkingChime()
      o.setStatus('thinking')

      try {
        turnsRef.current += 1
        const thisTurn = turnsRef.current

        const snap = snapshotRef.current || {}
        const ctx = {
          uid: snap.uid,
          modeId: snap.modeId,
          subjects: snap.subjects || [],
          habits: snap.habits || [],
          todos: snap.todos || [],
          slots: snap.slots || [],
        }
        const history = [...historyRef.current, { role: 'user', text: command }]

        const { text: reply, toolEvents = [] } = await chatWithGemini(
          history,
          buildVoiceContext(snap),
          ctx,
        )
        const replyText = (reply || '').trim() || 'Done.'
        const isDismiss = toolEvents.some(
          (ev) => ev.name === 'dismiss_assistant' || ev.dismissed,
        )
        isDismissingRef.current = isDismiss

        // Persist conversation memory (bounded so context stays cheap).
        historyRef.current = [
          ...history,
          { role: 'assistant', text: replyText },
        ].slice(-12)

        o.setStatus('speaking')
        o.onFeedback?.({ userText: command, replyText, toolEvents })

        speak(replyText, {
          voiceEnabled: o.voiceEnabled !== false,
          onEnd: () => {
            spokenRef.current = ''
            if (isDismissingRef.current) {
              playSleepChime()
              o.setActive(false)
              o.setStatus('idle')
              stop()
              stopSpeaking()
              turnsRef.current = 0
            } else if (thisTurn >= (o.turnLimit || 8)) {
              o.setActive(false)
              o.setStatus('idle')
              stop()
              stopSpeaking()
              turnsRef.current = 0
              o.onLimit?.('turn-limit')
            } else if (activeRef.current) {
              playListeningChime()
              o.setStatus('listening')
              lastActivityRef.current = Date.now()
              start()
            } else {
              o.setStatus('idle')
            }
          },
        })
      } catch (err) {
        o.setStatus('idle')
        o.setActive(false)
        o.onLimit?.(`error:${err?.message || 'AI error'}`)
      }
    },
    [start, stop],
  )

  // Interrupt speech (voice barge-in or button) and return to listening.
  const interrupt = useCallback(() => {
    stopSpeaking()
    playThinkingChime()
    if (activeRef.current) {
      optsRef.current.setStatus('listening')
      lastActivityRef.current = Date.now()
      start()
    }
  }, [start])

  /* ── accumulate transcript, wake-word gate & voice barge-in ── */
  useEffect(() => {
    if (!transcript) return
    const incoming = transcript.trim()
    const o = optsRef.current

    // Voice Barge-in while assistant is speaking:
    if (statusRef.current === 'speaking') {
      const match = incoming.match(INTERRUPT_PATTERN)
      if (match || incoming.split(/\s+/).length >= 2) {
        stopSpeaking()
        playThinkingChime()
        o.setStatus('listening')
        lastActivityRef.current = Date.now()
        const cleaned = incoming.replace(INTERRUPT_PATTERN, '').trim()
        spokenRef.current = cleaned
        resetSpeech()
        start()
        return
      }
    }

    const next = (spokenRef.current + ' ' + incoming).trim()
    spokenRef.current = next

    if (!activeRef.current) {
      // Inactive: only a wake phrase promotes us into a conversation.
      const re = buildWakeRegex(o.wakeWord)
      if (re) {
        const m = next.match(re)
        if (m) {
          o.onWake?.()
          playWakeChime()
          o.setActive(true)
          const trailing = (m[1] || '').trim()
          spokenRef.current = ''

          if (trailing && trailing.length >= 2) {
            // Wake word + command in one sentence ("Hey Track, what's due today?")
            submitText(trailing)
          } else {
            stop()
            o.setStatus('speaking')
            speak("Yes? I'm listening.", {
              voiceEnabled: o.voiceEnabled !== false,
              onEnd: () => {
                playListeningChime()
                o.setStatus('listening')
                lastActivityRef.current = Date.now()
                start()
              },
            })
          }
        } else {
          spokenRef.current = ''
        }
      } else {
        spokenRef.current = ''
      }
    }
    resetSpeech()
  }, [transcript, resetSpeech, start, stop, submitText])

  /* ── Web Speech silence → auto-submit ── */
  useEffect(() => {
    if (!active || status !== 'listening' || isFallback) return
    if (spokenRef.current || interim) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        const final = (spokenRef.current + ' ' + (interim || '')).trim()
        if (final) submitText(final)
      }, 1500)
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }
  }, [active, status, isFallback, interim, submitText])

  /* ── Fallback (MediaRecorder) VAD self-heal ── */
  useEffect(() => {
    if (!isFallback || transcribing) return
    if (!listening) {
      if (active && status === 'listening') {
        const cleaned = spokenRef.current.trim()
        if (cleaned.length >= 2) submitText(cleaned)
        else {
          spokenRef.current = ''
          start()
        }
      } else if (!active && wakeWord && !suppressed) {
        spokenRef.current = ''
        start()
      }
    }
  }, [listening, transcribing, active, status, isFallback, wakeWord, suppressed, submitText, start])

  /* ── idle auto-pause (token / battery guard) ── */
  useEffect(() => {
    if (!active || status !== 'listening') return
    const checker = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= idleMs) {
        playSleepChime()
        optsRef.current.setActive(false)
        optsRef.current.setStatus('idle')
        stop()
        stopSpeaking()
        optsRef.current.onLimit?.('idle')
      }
    }, 2000)
    return () => clearInterval(checker)
  }, [active, status, idleMs, stop])

  /* ── master mic control (keeps mic active during speaking for voice barge-in) ── */
  useEffect(() => {
    const shouldListen =
      !suppressed &&
      (active ? status === 'listening' || status === 'speaking' : Boolean(wakeWord))
    if (shouldListen) start()
    else stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suppressed, active, status, wakeWord])

  // Full teardown on unmount.
  useEffect(() => {
    return () => {
      stopSpeaking()
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }
  }, [])

  return {
    transcript: spokenRef.current,
    interim,
    speechError,
    isFallback,
    transcribing,
    listening,
    submitText,
    interrupt,
  }
}
