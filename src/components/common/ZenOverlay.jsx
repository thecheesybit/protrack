import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Zap, Volume2, VolumeX } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useIdleDetection } from '@/hooks/useIdleDetection'
import { useSubjects } from '@/hooks/useSubjects'
import { useTodos } from '@/hooks/useWellness'
import { fetchZenQuote, getElevenLabsKey } from '@/services/geminiService'
import { classifyDeadline } from '@/lib/deadlines'
import { cn } from '@/utils/cn'

const MIN_DURATION_MS = 15000

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain", category: "productivity", language: "en", mood: "motivating" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", category: "philosophy", language: "en", mood: "calm" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King", category: "productivity", language: "en", mood: "sharp" },
  { text: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr.", category: "productivity", language: "en", mood: "motivating" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss", category: "productivity", language: "en", mood: "sharp" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin", category: "productivity", language: "en", mood: "reflective" },
  { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem", category: "productivity", language: "en", mood: "sharp" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh", category: "modern", language: "en", mood: "calm" },
]

function computeRecs(subjects, todos) {
  const recs = []
  const lagging = subjects
    .filter((s) => (s.progressPct || 0) < 50)
    .sort((a, b) => (a.progressPct || 0) - (b.progressPct || 0))
  if (lagging[0]) {
    recs.push({
      id: `s-${lagging[0].id}`,
      question: `${lagging[0].name} is at ${lagging[0].progressPct || 0}% — start a focus session?`,
      kind: 'focus',
      _subject: lagging[0],
    })
  }
  const overdueTodo = todos.find((t) => !t.done && classifyDeadline(t.dueAt) === 'overdue')
  if (overdueTodo) {
    recs.push({
      id: `t-${overdueTodo.id}`,
      question: `"${overdueTodo.text}" is overdue — add it to today's focus?`,
      kind: 'deadline',
      _todo: overdueTodo,
    })
  }
  return recs.slice(0, 2)
}

const fadeOutActiveAudio = () => {
  if (typeof window !== 'undefined' && window.activeZenAudio) {
    const audio = window.activeZenAudio
    let vol = audio.volume
    const fadeInterval = setInterval(() => {
      if (vol > 0.1) {
        vol -= 0.1
        audio.volume = Math.max(0, vol)
      } else {
        clearInterval(fadeInterval)
        audio.pause()
        if (window.activeZenAudio === audio) {
          window.activeZenAudio = null
        }
      }
    }, 100)
  }
}

const stopSpeaking = () => {
  if (typeof window !== 'undefined') {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (window.activeZenAudio) {
      window.activeZenAudio.pause()
      window.activeZenAudio = null
    }
  }
}

const speakQuote = async (quote, voiceEnabled) => {
  if (!voiceEnabled) return

  stopSpeaking()
  const cleanText = quote.text.replace(/\n/g, ' ')

  const elKey = getElevenLabsKey()
  if (elKey) {
    try {
      const voiceId = '21m00Tcm4TlvDq8ikWAM' // Rachel voice (calm/meditative)
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
      if (response.ok) {
        const blob = await response.blob()
        const audioUrl = URL.createObjectURL(blob)
        const audio = new Audio(audioUrl)
        audio.volume = 0.9
        window.activeZenAudio = audio
        audio.play()
        return
      }
    } catch (err) {
      console.warn('[zen-tts] ElevenLabs failed, falling back to Web Speech', err)
    }
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 0.75 // low pace
    utterance.pitch = 0.85 // low pitch

    const voices = window.speechSynthesis.getVoices()
    if (quote.language === 'hi' || quote.language === 'ur') {
      const hiVoice = voices.find(v => v.lang.startsWith('hi'))
      if (hiVoice) utterance.voice = hiVoice
      utterance.lang = 'hi-IN'
    } else {
      const enVoice = voices.find(v => v.lang.startsWith('en'))
      if (enVoice) utterance.voice = enVoice
      utterance.lang = 'en-US'
    }

    window.speechSynthesis.speak(utterance)
  }
}

export function ZenOverlay() {
  const { isIdle } = useIdleDetection(180000)
  const [show, setShow] = useState(false)
  const [quote, setQuote] = useState(QUOTES[0])

  const autoTimerRef = useRef(null)
  const activeModeId = useStore((s) => s.activeModeId)
  const settings = useStore((s) => s.settings)
  
  const zenEnabled = useStore((s) => s.settings?.zenEnabled !== false)
  const zenDuration = useStore((s) => s.settings?.zenDuration || 60000)
  const openFocus = useStore((s) => s.openFocus)
  const focusRunning = useStore((s) => s.status === 'running')
  const focusLocked = useStore((s) => s.focusLocked)
  const isBlocked = focusRunning || focusLocked || !zenEnabled

  const { subjects } = useSubjects(activeModeId)
  const todos = useTodos()
  const recs = computeRecs(subjects, todos)

  const dismiss = useCallback(() => {
    clearTimeout(autoTimerRef.current)
    stopSpeaking()
    setShow(false)
  }, [])

  const nextQuote = useCallback(async () => {
    fadeOutActiveAudio()
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    let history = []
    try {
      history = JSON.parse(localStorage.getItem('protrack:zen_history')) || []
    } catch { /* private */ }
    if (history.length > 30) history = history.slice(history.length - 30)

    let newQuote = null
    const categories = settings?.zenCategories || ['stoic', 'philosophy', 'productivity', 'proverbs', 'hindi_urdu', 'modern']

    try {
      const res = await fetch('/zen_quotes.json')
      const pool = await res.json()
      const filteredPool = pool.filter((q) => categories.includes(q.category))
      const finalPool = filteredPool.length > 0 ? filteredPool : pool

      const available = finalPool.filter((q) => !history.find((h) => h.text === q.text))
      newQuote = available.length
        ? available[Math.floor(Math.random() * available.length)]
        : finalPool[Math.floor(Math.random() * finalPool.length)]
    } catch (err) {
      console.warn('[zen] fallback to static', err)
      const available = QUOTES.filter((q) => !history.find((h) => h.text === q.text))
      newQuote = available.length
        ? available[Math.floor(Math.random() * available.length)]
        : QUOTES[Math.floor(Math.random() * QUOTES.length)]
    }

    if (newQuote) {
      history.push({ text: newQuote.text, author: newQuote.author, date: Date.now() })
      try {
        localStorage.setItem('protrack:zen_history', JSON.stringify(history))
      } catch {}
      setQuote(newQuote)
      
      const voiceEnabled = settings?.zenVoiceEnabled !== false
      speakQuote(newQuote, voiceEnabled)

      const duration = Math.max(MIN_DURATION_MS, zenDuration)
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = setTimeout(() => {
        dismiss()
      }, duration)
    }
  }, [settings, zenDuration, dismiss])

  useEffect(() => {
    if (!show) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        dismiss()
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        nextQuote()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [show, dismiss, nextQuote])

  useEffect(() => {
    let active = true

    if (isBlocked) {
      setShow(false)
      stopSpeaking()
      return
    }

    if (isIdle) {
      const run = async () => {
        let history = []
        try {
          history = JSON.parse(localStorage.getItem('protrack:zen_history')) || []
        } catch {}
        if (history.length > 30) history = history.slice(history.length - 30)

        let newQuote = null
        const categories = settings?.zenCategories || ['stoic', 'philosophy', 'productivity', 'proverbs', 'hindi_urdu', 'modern']

        try {
          const res = await fetch('/zen_quotes.json')
          const pool = await res.json()
          const filteredPool = pool.filter((q) => categories.includes(q.category))
          const finalPool = filteredPool.length > 0 ? filteredPool : pool

          const available = finalPool.filter((q) => !history.find((h) => h.text === q.text))
          newQuote = available.length
            ? available[Math.floor(Math.random() * available.length)]
            : finalPool[Math.floor(Math.random() * finalPool.length)]
        } catch {
          const available = QUOTES.filter((q) => !history.find((h) => h.text === q.text))
          newQuote = available.length
            ? available[Math.floor(Math.random() * available.length)]
            : QUOTES[Math.floor(Math.random() * QUOTES.length)]
        }

        if (!active) return

        history.push({ text: newQuote.text, author: newQuote.author, date: Date.now() })
        try {
          localStorage.setItem('protrack:zen_history', JSON.stringify(history))
        } catch {}

        setQuote(newQuote)
        setShow(true)

        const voiceEnabled = settings?.zenVoiceEnabled !== false
        speakQuote(newQuote, voiceEnabled)

        const duration = Math.max(MIN_DURATION_MS, zenDuration)
        clearTimeout(autoTimerRef.current)
        autoTimerRef.current = setTimeout(() => {
          if (active) dismiss()
        }, duration)
      }
      run()
    }

    return () => {
      active = false
      clearTimeout(autoTimerRef.current)
    }
  }, [isIdle, isBlocked, settings, zenDuration, dismiss])

  const quoteLines = quote.text.split('\n')

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="zen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 1.0, ease: 'easeIn' },
          }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          onClick={nextQuote}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center p-8 text-center select-none"
        >
          {/* Ambient Background Mesh */}
          <div className="absolute inset-0 overflow-hidden -z-10 bg-bg">
            <motion.div
              animate={{
                x: [0, 80, -40, 0],
                y: [0, -60, 40, 0],
                scale: [1, 1.15, 0.9, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-accent/6 blur-[120px]"
            />
            <motion.div
              animate={{
                x: [0, -60, 80, 0],
                y: [0, 50, -40, 0],
                scale: [1, 0.9, 1.1, 1],
              }}
              transition={{
                duration: 30,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="absolute -bottom-[20%] -right-[10%] w-[65%] h-[65%] rounded-full bg-indigo-500/4 blur-[130px]"
            />
          </div>

          {/* Close / Exit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
            aria-label="Exit Zen Mode"
            className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-xl border border-line/40 bg-surface/30 text-muted backdrop-blur transition-colors hover:text-ink hover:border-line"
          >
            <X className="h-4 w-4" />
          </button>

          <motion.div
            className="flex max-w-3xl flex-col items-center gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Line by line slow staggered fade in */}
            <div className="flex flex-col gap-3.5 mb-2">
              {quoteLines.map((line, idx) => (
                <motion.p
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: idx * 0.9,
                    duration: 1.4,
                    ease: 'easeOut',
                  }}
                  className={cn(
                    'leading-relaxed text-ink/90',
                    quote.language === 'hi' || quote.language === 'ur'
                      ? 'text-4xl md:text-5xl font-hindi'
                      : 'text-3xl md:text-4xl font-serif-quote italic'
                  )}
                >
                  {line}
                </motion.p>
              ))}
            </div>

            {/* Transliteration for Hindi / Urdu */}
            {quote.transliteration && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{
                  delay: quoteLines.length * 0.9 + 0.3,
                  duration: 1.2,
                }}
                className="text-sm md:text-base font-serif italic text-muted max-w-2xl mx-auto leading-relaxed mt-2"
              >
                "{quote.transliteration}"
              </motion.p>
            )}

            {/* Translation for non-English quotes */}
            {quote.translation && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.75 }}
                transition={{
                  delay: quoteLines.length * 0.9 + (quote.transliteration ? 0.9 : 0.4),
                  duration: 1.2,
                }}
                className="text-xs md:text-sm text-ink/75 max-w-xl mx-auto leading-relaxed mt-1.5"
              >
                {quote.translation}
              </motion.p>
            )}

            {/* Author */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              transition={{
                delay: quoteLines.length * 0.9 + (quote.transliteration || quote.translation ? 1.4 : 0.6),
                duration: 1.2,
              }}
              className="text-xs uppercase tracking-[0.25em] font-semibold text-muted font-cinzel mt-4"
            >
              — {quote.author}
            </motion.p>

            {/* Recommendation chips */}
            {recs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: quoteLines.length * 0.9 + 2.0, duration: 0.8 }}
                className="flex flex-col items-center gap-2 mt-8"
              >
                {recs.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-3 rounded-2xl border border-line/45 bg-surface/30 px-4 py-2.5 backdrop-blur-xl"
                  >
                    <Zap className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="text-sm text-ink/75">{rec.question}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (rec.kind === 'focus' && rec._subject) {
                          openFocus({
                            title: rec._subject.name,
                            color: rec._subject.color,
                            subjectId: rec._subject.id,
                            modeId: rec._subject._modeId || activeModeId,
                          })
                        }
                        dismiss()
                      }}
                      className="shrink-0 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 shadow-glow-sm"
                    >
                      Yes
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.2 }}
              transition={{ delay: quoteLines.length * 0.9 + 2.5 }}
              className="text-[10px] text-muted/60 tracking-wider uppercase mt-6"
            >
              Click background or press Space for next · Esc to exit
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
