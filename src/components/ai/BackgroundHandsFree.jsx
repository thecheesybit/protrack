import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { useTimetable } from '@/hooks/useTimetable'
import { useHabits, useTodos } from '@/hooks/useWellness'
import { chatWithGemini } from '@/services/geminiService'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { speak, stopSpeaking } from '@/lib/tts'
import { todayDow } from '@/lib/time'
import toast from 'react-hot-toast'

function playChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    
    // Pleasant double chime: 523Hz (C5) then 659Hz (E5)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime) // C5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime)
    osc.start()
    
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1) // E5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.1)
    
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45)
    osc.stop(audioCtx.currentTime + 0.45)
  } catch (e) {
    console.warn('Failed to play audio chime:', e)
  }
}

// TTS is centralized in src/lib/tts.js (tiered ElevenLabs → OpenAI → natural
// Web Speech). `speak(text, { voiceEnabled, onStart, onEnd })` mirrors the old
// speakHandsFree signature; `stopSpeaking()` interrupts any tier.

export function BackgroundHandsFree() {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const modes = useStore((s) => s.modes)
  const stats = useStore((s) => s.stats)
  const { subjects } = useSubjects(activeModeId)
  const { slots } = useTimetable(activeModeId)
  const habits = useHabits()
  const todos = useTodos()

  // State sync selectors
  const aiOpen = useStore((s) => s.aiOpen)
  const handsFreeActive = useStore((s) => s.handsFreeActive)
  const setHandsFreeActive = useStore((s) => s.setHandsFreeActive)
  const handsFreeStatus = useStore((s) => s.handsFreeStatus)
  const setHandsFreeStatus = useStore((s) => s.setHandsFreeStatus)
  const setHandsFreeFeedback = useStore((s) => s.setHandsFreeFeedback)
  
  // Settings limit
  const turnLimit = useStore((s) => s.settings?.handsFreeTurnLimit || 6)

  const activeMode = modes.find((m) => m.id === activeModeId)
  
  // Refs
  const silenceTimerRef = useRef(null)
  const latestSpokenRef = useRef('')
  const lastActivityRef = useRef(Date.now())
  const spokenTextRef = useRef('')
  const consecutiveTurnsRef = useRef(0)
  const handsFreeActiveRef = useRef(handsFreeActive)

  useEffect(() => {
    handsFreeActiveRef.current = handsFreeActive
  }, [handsFreeActive])

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
    speechActive
  } = useSpeechRecognition()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking()
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      setHandsFreeStatus('idle')
      setHandsFreeFeedback(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync turn count and status on mount/toggle
  useEffect(() => {
    consecutiveTurnsRef.current = 0
    if (handsFreeActive) {
      setHandsFreeStatus('listening')
    } else {
      setHandsFreeStatus('idle')
    }
  }, [handsFreeActive, setHandsFreeStatus])

  // Track absolute voice activity
  useEffect(() => {
    if (transcript || interim || speechActive) {
      lastActivityRef.current = Date.now()
    }
  }, [transcript, interim, speechActive])

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

  // Submits speech to LLM
  const handleSubmitText = useCallback(async (textToSubmit) => {
    if (!textToSubmit || handsFreeStatus === 'thinking' || handsFreeStatus === 'speaking') return

    // If handsFreeActive was just triggered, the wake word is already stripped.
    // If they are in handsFreeMode, they don't need the wake word for every conversational turn.
    const command = textToSubmit.trim()
    if (!command) return

    // Noise/Filler Filter Guard on the command text
    const cleanText = command.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    const words = cleanText.split(/\s+/)
    const fillers = ['uh', 'um', 'ah', 'ok', 'okay', 'like', 'er', 'eh', 'hm', 'hmm']
    const isFillerOnly = words.every(w => fillers.includes(w.toLowerCase()))
    const isTooShort = cleanText.length < 3

    if (isTooShort || isFillerOnly) {
      console.log('[hands-free-background] Filtered filler/noise command:', command)
      spokenTextRef.current = ''
      latestSpokenRef.current = ''
      if (handsFreeActive) {
        setHandsFreeStatus('listening')
        start()
      }
      return
    }

    // Stop recording first
    stop()
    setHandsFreeStatus('thinking')

    try {
      const nextTurn = consecutiveTurnsRef.current + 1
      consecutiveTurnsRef.current = nextTurn

      const { text: reply } = await chatWithGemini(
        [{ role: 'user', text: command }],
        buildContext(),
        ctx
      )

      setHandsFreeStatus('speaking')
      setHandsFreeFeedback({ userText: command, replyText: reply })

      speak(reply, {
        voiceEnabled: true,
        onStart: () => {},
        onEnd: () => {
          // Speech end callback -> check turn limits & cycle back to listening
          spokenTextRef.current = ''
          latestSpokenRef.current = ''

          if (nextTurn >= turnLimit) {
            setHandsFreeActive(false)
            setHandsFreeStatus('idle')
            stop()
            stopSpeaking()
            toast(`Hands-free paused (${turnLimit} turn limit reached) to save tokens.`, {
              icon: '🛑',
              duration: 5000
            })
            consecutiveTurnsRef.current = 0
          } else if (handsFreeActiveRef.current) {
            setHandsFreeStatus('listening')
            lastActivityRef.current = Date.now() // reset activity timestamp
            start()
          }
        },
      })
    } catch (err) {
      toast.error('AI voice error: ' + err.message)
      setHandsFreeStatus('idle')
      setHandsFreeActive(false)
    }
  }, [handsFreeStatus, handsFreeActive, turnLimit, start, stop, ctx, buildContext, setHandsFreeActive, setHandsFreeFeedback, setHandsFreeStatus])

  // Accumulate speech transcript and check wake word
  useEffect(() => {
    if (transcript) {
      const next = (spokenTextRef.current + ' ' + transcript).trim()
      spokenTextRef.current = next
      latestSpokenRef.current = next
      
      // If hands-free is inactive, we look for the wake word to activate it
      if (!handsFreeActive && !aiOpen) {
        const match = next.match(/^(?:hey\s+)?resist[,\s]*(.*)/i)
        if (match) {
          playChime()
          setHandsFreeActive(true)
          const command = match[1].trim()
          if (command) {
            spokenTextRef.current = command
            latestSpokenRef.current = command
            // The silence detector or MediaRecorder onstop will automatically trigger handleSubmitText on the command
          } else {
            // Greet the user
            spokenTextRef.current = ''
            latestSpokenRef.current = ''
            stop()
            setHandsFreeStatus('speaking')
            speak("Yes, I'm listening. What can I do for you?", {
              voiceEnabled: true,
              onEnd: () => {
                setHandsFreeStatus('listening')
                lastActivityRef.current = Date.now()
                start()
              },
            })
          }
        } else {
          // Not a wake word, clear transcript buffer immediately
          spokenTextRef.current = ''
          latestSpokenRef.current = ''
        }
      }
      resetSpeech()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, resetSpeech, handsFreeActive, aiOpen, start, stop])

  // Silence checker for Web Speech
  useEffect(() => {
    if (!handsFreeActive || handsFreeStatus !== 'listening' || isFallback) return

    const accumulated = spokenTextRef.current
    if (accumulated || interim) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)

      silenceTimerRef.current = setTimeout(() => {
        const finalSubmitText = (accumulated + ' ' + interim).trim()
        if (finalSubmitText) {
          handleSubmitText(finalSubmitText)
        }
      }, 1800)
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    }
  }, [handsFreeActive, handsFreeStatus, isFallback, interim, handleSubmitText])

  // Silence checker for fallback MediaRecorder VAD
  useEffect(() => {
    if (!isFallback || transcribing || aiOpen) return

    if (!listening) {
      // If hands-free is active, submit the command.
      // If inactive, just restart the mic to keep listening for the wake word.
      if (handsFreeActive && handsFreeStatus === 'listening') {
        const cleaned = spokenTextRef.current.trim()
        if (cleaned.length > 2) {
          handleSubmitText(cleaned)
        } else {
          spokenTextRef.current = ''
          latestSpokenRef.current = ''
          start()
        }
      } else if (!handsFreeActive) {
        // Not active, just keep listening for wake word
        spokenTextRef.current = ''
        latestSpokenRef.current = ''
        start()
      }
    }
  }, [listening, transcribing, handsFreeActive, handsFreeStatus, isFallback, handleSubmitText, start, aiOpen])

  // Inactivity auto-pause loop: checks every 2 seconds
  useEffect(() => {
    if (!handsFreeActive || handsFreeStatus !== 'listening') return

    const checker = setInterval(() => {
      const idleTime = Date.now() - lastActivityRef.current
      const MAX_IDLE_MS = 30000 // 30 seconds

      if (idleTime >= MAX_IDLE_MS) {
        setHandsFreeActive(false)
        setHandsFreeStatus('idle')
        stop()
        stopSpeaking()
        toast('Hands-free mode paused due to inactivity.', {
          icon: '⏳',
          duration: 5000
        })
      }
    }, 2000)

    return () => clearInterval(checker)
  }, [handsFreeActive, handsFreeStatus, stop, setHandsFreeActive, setHandsFreeStatus])

  // Control background microphone based on active modes & overlays
  useEffect(() => {
    if (aiOpen) {
      stop()
      stopSpeaking()
    } else {
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOpen, handsFreeActive])

  // Alert message display on speech recognition errors
  useEffect(() => {
    if (handsFreeActive && speechError) {
      toast.error('Voice loop error: ' + speechError)
    }
  }, [speechError, handsFreeActive])

  return null
}
