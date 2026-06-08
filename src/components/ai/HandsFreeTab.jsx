import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Sparkles, Volume2, VolumeX, AlertTriangle, Mic, HelpCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { useTimetable } from '@/hooks/useTimetable'
import { useHabits, useTodos } from '@/hooks/useWellness'
import { chatWithGemini, hasGeminiKey, getElevenLabsKey } from '@/services/geminiService'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { todayDow } from '@/lib/time'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

import aiGif from '@/assets/ai.gif'

// Speech synthesis helpers
let activeSpeechUtterance = null

function speakHandsFree(text, voiceEnabled, onStart, onEnd) {
  if (!voiceEnabled) {
    onEnd?.()
    return
  }

  // Stop any active speech first
  stopHandsFreeSpeaking()

  const cleanText = text.replace(/\n/g, ' ')
  const elKey = getElevenLabsKey()

  if (elKey) {
    const voiceId = '21m00Tcm4TlvDq8ikWAM' // Rachel voice (calm/meditative)
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elKey
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.8,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    })
      .then(async (response) => {
        if (response.ok) {
          const blob = await response.blob()
          const audioUrl = URL.createObjectURL(blob)
          const audio = new Audio(audioUrl)
          audio.volume = 0.9
          window.activeHandsFreeAudio = audio
          audio.onplay = () => onStart?.()
          audio.onended = () => {
            window.activeHandsFreeAudio = null
            onEnd?.()
          }
          audio.onerror = () => {
            window.activeHandsFreeAudio = null
            onEnd?.()
          }
          audio.play()
        } else {
          throw new Error('ElevenLabs API returned error status')
        }
      })
      .catch((err) => {
        console.warn('[hands-free-tts] ElevenLabs failed, falling back to Web Speech', err)
        fallbackWebSpeech(cleanText, onStart, onEnd)
      })
  } else {
    fallbackWebSpeech(cleanText, onStart, onEnd)
  }
}

function fallbackWebSpeech(text, onStart, onEnd) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.()
    return
  }
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.85
  utterance.pitch = 0.9

  const voices = window.speechSynthesis.getVoices()
  const enVoice = voices.find(v => v.lang.startsWith('en'))
  if (enVoice) utterance.voice = enVoice
  utterance.lang = 'en-US'

  utterance.onstart = () => onStart?.()
  utterance.onend = () => {
    activeSpeechUtterance = null
    onEnd?.()
  }
  utterance.onerror = () => {
    activeSpeechUtterance = null
    onEnd?.()
  }

  activeSpeechUtterance = utterance
  window.speechSynthesis.speak(utterance)
}

function stopHandsFreeSpeaking() {
  if (typeof window !== 'undefined') {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    activeSpeechUtterance = null
    if (window.activeHandsFreeAudio) {
      window.activeHandsFreeAudio.pause()
      window.activeHandsFreeAudio = null
    }
  }
}

export function HandsFreeTab({ onOpenSettings }) {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const modes = useStore((s) => s.modes)
  const stats = useStore((s) => s.stats)
  const { subjects } = useSubjects(activeModeId)
  const { slots } = useTimetable(activeModeId)
  const habits = useHabits()
  const todos = useTodos()

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [spokenText, setSpokenText] = useState('')
  const [responseHtml, setResponseHtml] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  // Token & activity limiting states
  const [consecutiveTurns, setConsecutiveTurns] = useState(0)

  const activeMode = modes.find((m) => m.id === activeModeId)
  const silenceTimerRef = useRef(null)
  const latestSpokenRef = useRef('')
  const lastActivityRef = useRef(Date.now())
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  const {
    supported,
    listening,
    transcript,
    interim,
    error: speechError,
    transcribing,
    start,
    stop,
    reset: resetSpeech,
    isFallback,
    speechActive
  } = useSpeechRecognition()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHandsFreeSpeaking()
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }
  }, [])

  // Keep track of voice activity timestamps
  useEffect(() => {
    if (transcript || interim || speechActive) {
      lastActivityRef.current = Date.now()
    }
  }, [transcript, interim, speechActive])

  // Sync speech transcript
  useEffect(() => {
    if (transcript) {
      setSpokenText((prev) => {
        const next = (prev + ' ' + transcript).trim()
        latestSpokenRef.current = next
        return next
      })
      resetSpeech()
    }
  }, [transcript, resetSpeech])

  // Context builder
  const buildContext = useCallback(() => {
    const today = todayDow()
    const subjLines = subjects
      .map((s) => `- ${s.name}: ${s.progressPct || 0}% (${(s.flags || []).length} pending notes)`)
      .join('\n')
    const todaySlots = slots.filter((s) => s.dayOfWeek === today).map((s) => s.label).join(', ')
    const habitLines = habits.map((h) => `- ${h.name}`).join('\n')
    const todoLines = todos
      .filter((t) => !t.done)
      .slice(0, 10)
      .map((t) => `- ${t.text}`)
      .join('\n')
    return [
      `Active mode: ${activeMode?.name || '—'} (id: ${activeModeId || 'none'})`,
      `Subjects:\n${subjLines || '  (none yet)'}`,
      `Habits:\n${habitLines || '  (none yet)'}`,
      `Open to-dos:\n${todoLines || '  (none)'}`,
      `Today's sessions: ${todaySlots || 'none planned'}`,
      `Focus stats: ${stats?.currentStreak || 0}-day streak, ${Math.round((stats?.totalFocusMin || 0) / 60)}h total, ${stats?.treesGrown || 0} sessions completed.`,
    ].join('\n')
  }, [activeMode?.name, activeModeId, subjects, slots, habits, todos, stats])

  const ctx = useMemo(() => ({
    uid: user?.uid,
    modeId: activeModeId,
    subjects,
    habits,
    todos
  }), [user?.uid, activeModeId, subjects, habits, todos])

  // Submits the spoken speech to the AI
  const handleSubmitText = useCallback(async (textToSubmit) => {
    if (!textToSubmit || status === 'thinking' || status === 'speaking') return

    // Noise/Filler Filter Guard Rail:
    // Strip common punctuations and split into lowercase words
    const cleanText = textToSubmit.trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    const words = cleanText.split(/\s+/)
    const fillers = ['uh', 'um', 'ah', 'ok', 'okay', 'like', 'er', 'eh', 'hm', 'hmm']
    
    const isFillerOnly = words.every(w => fillers.includes(w.toLowerCase()))
    const isTooShort = cleanText.length < 3

    if (isTooShort || isFillerOnly) {
      console.log('[hands-free-filter] Ignored noise or filler sounds:', textToSubmit)
      setSpokenText('')
      latestSpokenRef.current = ''
      if (active) {
        setStatus('listening')
        start()
      }
      return
    }
    
    // Stop recording first
    stop()
    setStatus('thinking')
    
    try {
      const currentTurn = consecutiveTurns + 1
      setConsecutiveTurns(currentTurn)

      const { text: reply } = await chatWithGemini(
        [{ role: 'user', text: textToSubmit }],
        buildContext(),
        ctx
      )
      
      setResponseHtml(reply)
      setStatus('speaking')
      
      speakHandsFree(
        reply,
        voiceEnabled,
        () => {}, // onStart
        () => {
          // Speak ended -> check limits, resume listening if active
          setSpokenText('')
          latestSpokenRef.current = ''
          
          // Turn count limiter guard rail
          if (currentTurn >= 6) {
            setActive(false)
            setStatus('idle')
            stop()
            stopHandsFreeSpeaking()
            toast('Continuous loop paused (6 turn limit) to conserve API tokens.', {
              icon: '🛑',
              duration: 5000
            })
            setConsecutiveTurns(0)
          } else if (activeRef.current) {
            setStatus('listening')
            lastActivityRef.current = Date.now() // reset activity timer
            start()
          } else {
            setStatus('idle')
          }
        }
      )
    } catch (err) {
      toast.error('AI error: ' + err.message)
      setResponseHtml(`Error: ${err.message}`)
      setStatus('idle')
      setActive(false)
    }
  }, [status, ctx, voiceEnabled, active, start, stop, consecutiveTurns, buildContext])

  // VAD silence handler for Web Speech (non-fallback)
  useEffect(() => {
    if (!active || status !== 'listening' || isFallback) return

    // If user has spoken something and is silent
    if (spokenText || interim) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      
      silenceTimerRef.current = setTimeout(() => {
        const finalSubmitText = (spokenText + ' ' + interim).trim()
        if (finalSubmitText) {
          handleSubmitText(finalSubmitText)
        }
      }, 1800) // 1.8 seconds of silence -> auto-submit
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }
  }, [spokenText, interim, active, status, isFallback, handleSubmitText])

  // VAD self-healing loop for Fallback (MediaRecorder + Gemini transcription)
  useEffect(() => {
    if (!active || status !== 'listening' || !isFallback || transcribing) return

    if (!listening) {
      const cleaned = spokenText.trim()
      if (cleaned.length > 2) {
        handleSubmitText(cleaned)
      } else {
        // Silent block or noise: clear state and restart fallback recording immediately
        setSpokenText('')
        latestSpokenRef.current = ''
        start()
      }
    }
  }, [listening, transcribing, spokenText, active, status, isFallback, handleSubmitText, start])

  // Inactivity auto-pauser guard rail: check every 2 seconds
  useEffect(() => {
    if (!active || status !== 'listening') return

    const checker = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current
      const MAX_IDLE_MS = 30000 // 30 seconds of absolute silence

      if (idleTime >= MAX_IDLE_MS) {
        setActive(false)
        setStatus('idle')
        stop()
        stopHandsFreeSpeaking()
        toast('Hands-free mode paused due to inactivity.', {
          icon: '⏳',
          duration: 5000
        })
      }
    }, 2000)

    return () => clearInterval(checker)
  }, [active, status, stop])

  // Manage listening loop state changes
  useEffect(() => {
    if (active && status === 'listening') {
      start()
    } else {
      stop()
    }
  }, [active, status, start, stop])

  const startHandsFree = () => {
    if (!hasGeminiKey()) {
      toast.error('Please configure your Gemini API key first')
      return
    }
    setActive(true)
    setStatus('listening')
    setSpokenText('')
    latestSpokenRef.current = ''
    setResponseHtml('')
    setConsecutiveTurns(0)
    lastActivityRef.current = Date.now()
  }

  const pauseHandsFree = () => {
    setActive(false)
    setStatus('idle')
    stop()
    stopHandsFreeSpeaking()
    setConsecutiveTurns(0)
  }

  return (
    <div className="flex flex-1 flex-col p-6 overflow-y-auto min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center min-h-[340px]">
        {/* Animated AI GIF Icon */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Outermost ambient ring outline shadow */}
          <div className={cn(
            "absolute inset-0 rounded-full filter blur-xl transition-all duration-300 opacity-20 scale-110",
            status === 'listening' ? "bg-red-500 opacity-30" :
            status === 'thinking' ? "bg-accent opacity-25" :
            status === 'speaking' ? "bg-accent opacity-35" : "bg-transparent opacity-0 scale-95"
          )} />

          {/* GIF container */}
          <div className={cn(
            "relative h-36 w-36 rounded-full overflow-hidden border-2 bg-surface-2/40 backdrop-blur-sm transition-all duration-500 flex items-center justify-center shadow-lg",
            status === 'listening' ? "border-red-500/40 shadow-red-500/10 scale-105" :
            status === 'thinking' ? "border-accent/30 animate-pulse scale-98" :
            status === 'speaking' ? "border-accent shadow-glow scale-105" : "border-line/80 scale-100"
          )}>
            <img 
              src={aiGif} 
              alt="AI voice assistant" 
              className="h-full w-full object-cover select-none pointer-events-none" 
            />
          </div>
        </div>

        {/* State Label */}
        <div className="text-center mb-6">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ink/80">
            {status === 'listening' && 'Listening…'}
            {status === 'thinking' && 'Thinking…'}
            {status === 'speaking' && 'Speaking…'}
            {status === 'idle' && 'Hands-Free Assistant'}
          </h4>
          <p className="text-[10px] text-muted tracking-widest uppercase mt-0.5 font-semibold">
            {status === 'listening'
              ? 'Speak naturally, I will auto-detect silence'
              : status === 'thinking'
                ? 'Retrieving context and formulating response'
                : status === 'speaking'
                  ? 'Reading confirmation text aloud'
                  : 'Speak without keyboard interactions'}
          </p>
        </div>

        {/* Dynamic Voice Subtitle Box */}
        <div className="w-full max-w-md min-h-[90px] text-center rounded-2xl bg-surface-2/20 border border-line/40 p-4 flex items-center justify-center">
          {status === 'listening' && (
            <p className="text-xs text-ink/80 italic font-medium leading-relaxed">
              {spokenText || interim ? (
                <span>
                  {spokenText} <span className="text-accent">{interim}</span>
                </span>
              ) : (
                'Say something (e.g. "Add a task to read Chapter 5")'
              )}
            </p>
          )}
          {status === 'thinking' && (
            <span className="inline-flex gap-1.5 justify-center items-center">
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
            </span>
          )}
          {status === 'speaking' && (
            <p className="text-xs font-semibold text-accent leading-relaxed max-w-sm">
              {responseHtml}
            </p>
          )}
          {status === 'idle' && (
            <div className="flex flex-col gap-1 items-center justify-center">
              <p className="text-xs text-muted font-normal max-w-xs">
                Continuous voice loop allows you to speak tasks, ask progress, and receive audio confirmation hands-free.
              </p>
              {consecutiveTurns > 0 && (
                <span className="text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full mt-1.5">
                  Turn {consecutiveTurns} of 6
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Control Actions */}
      <div className="border-t border-line/50 pt-5 mt-auto flex flex-col gap-3 shrink-0">
        {speechError && (
          <div className="flex gap-2 items-center rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="font-medium">{speechError}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Voice Output Toggle */}
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors",
              voiceEnabled
                ? "border-accent/30 bg-accent/5 text-accent hover:bg-accent/10"
                 : "border-line text-muted hover:text-ink hover:bg-surface-2"
            )}
            title={voiceEnabled ? "Mute assistant speaking" : "Unmute assistant speaking"}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          {/* Main Loop Trigger */}
          {active ? (
            <button
              type="button"
              onClick={pauseHandsFree}
              className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 font-bold uppercase tracking-wider text-xs hover:bg-red-500/20 transition-all"
            >
              <Pause className="h-4 w-4" /> Pause Loop
            </button>
          ) : (
            <button
              type="button"
              onClick={startHandsFree}
              className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-white font-bold uppercase tracking-wider text-xs hover:bg-accent/90 transition-all shadow-glow-sm"
            >
              <Play className="h-4 w-4 fill-white" /> Start Hands-Free
            </button>
          )}
        </div>

        {/* Suggestions Box */}
        <div className="rounded-xl border border-line bg-surface-2/10 p-3 text-[11px] text-muted space-y-1.5">
          <p className="font-bold flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-accent" /> Recommended Voice Actions
          </p>
          <ul className="list-disc pl-4 space-y-1 font-medium">
            <li>"Add a todo item to check email at 3pm"</li>
            <li>"Mark my calculus homework as complete"</li>
            <li>"Schedule Biology study session for Tuesday at 4pm"</li>
            <li>"What subjects need my focus?"</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
