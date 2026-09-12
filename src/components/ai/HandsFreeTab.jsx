import { useState, useMemo, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, AlertTriangle, HelpCircle, Square, CheckCircle2, XCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useSubjects } from '@/hooks/useSubjects'
import { useTimetable } from '@/hooks/useTimetable'
import { useHabits, useTodos } from '@/hooks/useWellness'
import { hasGeminiKey } from '@/services/geminiService'
import { useVoiceAgent } from '@/hooks/useVoiceAgent'
import { getAlarms } from '@/services/alarmService'
import { stopSpeaking } from '@/lib/tts'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

import aiGif from '@/assets/ai.gif'

/**
 * The in-panel, full-screen Hands-Free experience. Unlike the ambient loop it
 * has no wake word (it's button-driven, and the panel already has focus) and it
 * surfaces everything the voice agent is doing: live transcript, the spoken
 * reply as captions, and the concrete actions taken as chips. All the state-
 * machine logic is shared via useVoiceAgent.
 */
export function HandsFreeTab() {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const modes = useStore((s) => s.modes)
  const stats = useStore((s) => s.stats)
  const { subjects } = useSubjects(activeModeId)
  const { slots } = useTimetable(activeModeId)
  const habits = useHabits()
  const todos = useTodos()

  const focusStatus = useStore((s) => s.status)
  const focusPhase = useStore((s) => s.phase)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const focusSession = useStore((s) => s.session)

  const [active, setActive] = useState(false)
  const [status, setStatus] = useState('idle') // 'idle'|'listening'|'thinking'|'speaking'
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [feedback, setFeedback] = useState(null) // { userText, replyText, toolEvents }

  const activeMode = modes.find((m) => m.id === activeModeId)

  const snapshot = useMemo(
    () => ({
      uid: user?.uid,
      modeId: activeModeId,
      modeName: activeMode?.name,
      modes,
      subjects,
      slots,
      habits,
      todos,
      alarms: getAlarms(),
      stats,
      focus: { status: focusStatus, phase: focusPhase, secondsLeft, session: focusSession },
    }),
    [
      user?.uid, activeModeId, activeMode?.name, modes, subjects, slots, habits,
      todos, stats, focusStatus, focusPhase, secondsLeft, focusSession,
    ],
  )

  const onLimit = useCallback((reason) => {
    if (reason === 'idle') toast('Paused after 30s of silence.', { icon: '⏳' })
    else if (reason === 'turn-limit') toast('Paused to conserve tokens.', { icon: '🛑' })
    else if (reason.startsWith('error:')) toast.error('AI error: ' + reason.slice(6))
  }, [])

  const { transcript, interim, speechError, interrupt } = useVoiceAgent({
    active,
    setActive,
    status,
    setStatus,
    snapshot,
    wakeWord: '',
    voiceEnabled,
    suppressed: false,
    turnLimit: 8,
    onFeedback: setFeedback,
    onLimit,
  })

  const startHandsFree = () => {
    if (!hasGeminiKey()) {
      toast.error('Add your Gemini API key in Settings first')
      return
    }
    setFeedback(null)
    setActive(true)
    setStatus('listening')
  }

  const stopHandsFree = () => {
    setActive(false)
    setStatus('idle')
    stopSpeaking()
  }

  const liveTranscript = (transcript + ' ' + (interim || '')).trim()

  return (
    <div className="flex flex-1 flex-col p-6 overflow-y-auto min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        {/* Animated orb */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className={cn(
            'absolute inset-0 rounded-full filter blur-xl transition-all duration-300 scale-110',
            status === 'listening' ? 'bg-red-500 opacity-30' :
            status === 'thinking' ? 'bg-accent opacity-25' :
            status === 'speaking' ? 'bg-accent opacity-35' : 'bg-transparent opacity-0 scale-95',
          )} />
          <div className={cn(
            'relative h-36 w-36 rounded-full overflow-hidden border-2 bg-surface-2/40 backdrop-blur-sm transition-all duration-500 flex items-center justify-center shadow-lg',
            status === 'listening' ? 'border-red-500/40 shadow-red-500/10 scale-105' :
            status === 'thinking' ? 'border-accent/30 animate-pulse scale-98' :
            status === 'speaking' ? 'border-accent shadow-glow scale-105' : 'border-line/80 scale-100',
          )}>
            <img src={aiGif} alt="AI voice assistant" className="h-full w-full object-cover select-none pointer-events-none" />
          </div>
        </div>

        {/* State label */}
        <div className="text-center mb-5">
          <h4 className="text-sm font-bold uppercase tracking-wider text-ink/80">
            {status === 'listening' && 'Listening…'}
            {status === 'thinking' && 'Thinking…'}
            {status === 'speaking' && 'Speaking…'}
            {status === 'idle' && 'Hands-Free Assistant'}
          </h4>
          <p className="text-[10px] text-muted tracking-widest uppercase mt-0.5 font-semibold">
            {status === 'listening' ? 'Speak naturally — I detect when you stop'
              : status === 'thinking' ? 'Understanding and acting on your request'
                : status === 'speaking' ? 'Reading the result aloud'
                  : 'Talk to run your whole workspace by voice'}
          </p>
        </div>

        {/* Live transcript / reply captions */}
        <div className="w-full max-w-md min-h-[92px] text-center rounded-2xl bg-surface-2/20 border border-line/40 p-4 flex flex-col items-center justify-center gap-2">
          {status === 'listening' && (
            <p className="text-xs text-ink/80 italic font-medium leading-relaxed">
              {liveTranscript || 'Say something like "start a 30 minute focus on Physics" or "what\'s due tomorrow?"'}
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
              {feedback?.replyText}
            </p>
          )}
          {status === 'idle' && (
            <p className="text-xs text-muted font-normal max-w-xs">
              {feedback?.replyText
                ? `Last: "${feedback.replyText}"`
                : 'A continuous voice loop: speak a request, I act on it and confirm out loud — no keyboard, no clicks.'}
            </p>
          )}
        </div>

        {/* Action chips from the last turn */}
        {feedback?.toolEvents?.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 max-w-md">
            {feedback.toolEvents.map((ev, j) => (
              <span
                key={j}
                className={ev.ok
                  ? 'inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400'
                  : 'inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-400'}
              >
                {ev.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {ev.summary || ev.error || ev.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-line/50 pt-5 mt-auto flex flex-col gap-3 shrink-0">
        {speechError && (
          <div className="flex gap-2 items-center rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="font-medium">{speechError}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl border transition-colors',
              voiceEnabled
                ? 'border-accent/30 bg-accent/5 text-accent hover:bg-accent/10'
                : 'border-line text-muted hover:text-ink hover:bg-surface-2',
            )}
            title={voiceEnabled ? 'Mute assistant speech' : 'Unmute assistant speech'}
          >
            {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          {status === 'speaking' && (
            <button
              type="button"
              onClick={interrupt}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-3 text-muted hover:text-ink hover:bg-surface-2 transition-colors"
              title="Interrupt and listen"
            >
              <Square className="h-4 w-4" /> Interrupt
            </button>
          )}

          {active ? (
            <button
              type="button"
              onClick={stopHandsFree}
              className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 font-bold uppercase tracking-wider text-xs hover:bg-red-500/20 transition-all"
            >
              <Pause className="h-4 w-4" /> Stop
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

        <div className="rounded-xl border border-line bg-surface-2/10 p-3 text-[11px] text-muted space-y-1.5">
          <p className="font-bold flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-accent" /> Try saying
          </p>
          <ul className="list-disc pl-4 space-y-1 font-medium">
            <li>&ldquo;Start a 25 minute focus session on Chemistry&rdquo;</li>
            <li>&ldquo;What&apos;s overdue?&rdquo; · &ldquo;How am I doing on my subjects?&rdquo;</li>
            <li>&ldquo;Add a to-do to email Professor Rao tomorrow at 9am&rdquo;</li>
            <li>&ldquo;Open my analytics&rdquo; · &ldquo;Switch to Exam mode&rdquo;</li>
            <li>&ldquo;Mark Calculus homework done&rdquo; · &ldquo;Set an alarm for 6:30am&rdquo;</li>
            <li>Say &ldquo;Stop&rdquo; to interrupt anytime · Say &ldquo;That&apos;s all, thanks&rdquo; to sleep</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
