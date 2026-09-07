import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  StickyNote,
  Plus,
  Search,
  Mic,
  Square,
  Play,
  Pause,
  Globe,
  Bookmark,
  Pin,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  FileText,
  Volume2,
  Clock,
  X,
  Radio,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useNotes } from '@/hooks/useNotes'
import {
  addNote,
  updateNote,
  deleteNote,
  togglePinNote,
} from '@/services/noteService'
import { WidgetFrame } from './WidgetFrame'
import { playSuccess, playPop } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

const TYPE_CONFIG = {
  all: { label: 'All', icon: StickyNote },
  memory: { label: 'Memories', icon: Sparkles, color: 'text-amber-400 bg-amber-400/10 border-amber-500/30' },
  voice: { label: 'Voice', icon: Mic, color: 'text-rose-400 bg-rose-400/10 border-rose-500/30' },
  link: { label: 'Links', icon: Globe, color: 'text-sky-400 bg-sky-400/10 border-sky-500/30' },
  note: { label: 'Notes', icon: FileText, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30' },
}

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function extractDomain(rawUrl) {
  try {
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return 'link'
  }
}

/**
 * Self-contained audio player component for recorded voice notes.
 */
function VoicePlayer({ audioData, duration }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef(null)

  const togglePlay = (e) => {
    e.stopPropagation()
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch((err) => {
        console.warn('Audio playback failed', err)
        toast.error('Unable to play audio recording')
      })
    }
  }

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const onEnded = () => {
    setPlaying(false)
    setCurrentTime(0)
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line/60 bg-surface-2/60 p-2 text-xs">
      <audio
        ref={audioRef}
        src={audioData}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        preload="metadata"
      />
      <button
        onClick={togglePlay}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all shadow-sm',
          playing
            ? 'bg-rose-500 text-white animate-pulse'
            : 'bg-accent text-white hover:scale-105',
        )}
        title={playing ? 'Pause audio' : 'Play voice memo'}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted">
          <span className="flex items-center gap-1 text-rose-400">
            <Volume2 className="h-3 w-3" /> Voice Memo
          </span>
          <span>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-gradient-to-r from-accent to-rose-400 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function NotesWidget({ widget, variant }) {
  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const notes = useNotes()
  const isHero = variant === 'hero'

  // Filter & search state
  const [filterType, setFilterType] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Intake State
  const [dropType, setDropType] = useState('note') // 'note' | 'memory' | 'voice' | 'link'
  const [dropText, setDropText] = useState('')
  const [dropTitle, setDropTitle] = useState('')
  const [dropUrl, setDropUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [voiceBlob, setVoiceBlob] = useState(null)
  const [voiceDataUrl, setVoiceDataUrl] = useState(null)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerIntervalRef = useRef(null)
  const speechRecognitionRef = useRef(null)

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop() } catch { /* noop */ }
      }
    }
  }, [])

  // Auto-detect link when pasting/typing into input
  const handleTextChange = (e) => {
    const val = e.target.value
    setDropText(val)
    if (val.trim().match(/^https?:\/\//i) && dropType !== 'link') {
      setDropType('link')
      setDropUrl(val.trim())
    }
  }

  // Voice recorder start/stop
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        setVoiceBlob(blob)
        const reader = new FileReader()
        reader.onloadend = () => {
          setVoiceDataUrl(reader.result)
        }
        reader.readAsDataURL(blob)
      }

      mr.start(200)
      setIsRecording(true)
      setRecordSeconds(0)

      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1)
      }, 1000)

      // Start speech recognition if available
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const sr = new SpeechRecognition()
        sr.continuous = true
        sr.interimResults = true
        sr.lang = 'en-US'
        sr.onresult = (e) => {
          let text = ''
          for (let i = 0; i < e.results.length; i++) {
            text += e.results[i][0].transcript + ' '
          }
          setVoiceTranscript(text.trim())
        }
        speechRecognitionRef.current = sr
        try { sr.start() } catch { /* noop */ }
      }
    } catch (err) {
      console.error('Microphone error', err)
      toast.error('Microphone permission required for voice notes')
    }
  }

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop() } catch { /* noop */ }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const cancelRecording = () => {
    stopRecording()
    setVoiceBlob(null)
    setVoiceDataUrl(null)
    setVoiceTranscript('')
    setRecordSeconds(0)
  }

  // Save note to Firestore
  const handleSave = async (e) => {
    e?.preventDefault()
    if (!user) return

    let contentToSave = dropText.trim()
    let titleToSave = dropTitle.trim()

    if (dropType === 'voice') {
      if (!voiceDataUrl) return toast.error('Record audio first')
      contentToSave = voiceTranscript || 'Voice recording'
      if (!titleToSave) titleToSave = `Voice Memo (${formatDuration(recordSeconds)})`
    } else if (dropType === 'link') {
      const url = dropUrl.trim() || contentToSave
      if (!url) return toast.error('Enter a valid URL')
      if (!titleToSave) titleToSave = extractDomain(url)
    } else {
      if (!contentToSave && !titleToSave) return toast.error('Enter some text or memory to save')
    }

    setIsSaving(true)
    try {
      await addNote(user.uid, {
        title: titleToSave,
        content: contentToSave,
        type: dropType,
        url: dropType === 'link' ? (dropUrl.trim() || contentToSave) : '',
        audioData: dropType === 'voice' ? voiceDataUrl : null,
        audioDuration: dropType === 'voice' ? recordSeconds : 0,
        transcript: dropType === 'voice' ? voiceTranscript : '',
        modeId: activeModeId === 'all' ? null : activeModeId,
      })

      playSuccess()
      toast.success(
        dropType === 'memory'
          ? 'Memory captured ✨'
          : dropType === 'voice'
            ? 'Voice note saved 🎙️'
            : dropType === 'link'
              ? 'Link dropped 🔗'
              : 'Note added 📝',
      )

      // Reset
      setDropText('')
      setDropTitle('')
      setDropUrl('')
      setVoiceBlob(null)
      setVoiceDataUrl(null)
      setVoiceTranscript('')
      setRecordSeconds(0)
    } catch (err) {
      console.error('Failed to save note', err)
      toast.error('Could not save note')
    } finally {
      setIsSaving(false)
    }
  }

  // Filtered and sorted notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        // Mode filter (if in a specific mode, show mode notes + global notes)
        if (activeModeId !== 'all' && n.modeId && n.modeId !== activeModeId) {
          return false
        }
        // Type filter
        if (filterType !== 'all' && (n.type || 'note') !== filterType) {
          return false
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchesTitle = n.title?.toLowerCase().includes(q)
          const matchesContent = n.content?.toLowerCase().includes(q)
          const matchesTranscript = n.transcript?.toLowerCase().includes(q)
          const matchesUrl = n.url?.toLowerCase().includes(q)
          return matchesTitle || matchesContent || matchesTranscript || matchesUrl
        }
        return true
      })
      .sort((a, b) => {
        // Pinned notes first
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
      })
  }, [notes, activeModeId, filterType, searchQuery])

  // Counts for pills
  const counts = useMemo(() => {
    const c = { all: notes.length, memory: 0, voice: 0, link: 0, note: 0 }
    notes.forEach((n) => {
      const t = n.type || 'note'
      if (c[t] != null) c[t] += 1
    })
    return c
  }, [notes])

  const copyToClipboard = (text, label = 'Copied to clipboard') => {
    navigator.clipboard.writeText(text)
    playPop()
    toast.success(label)
  }

  return (
    <WidgetFrame
      widget={widget}
      variant={variant}
      subtitle={`${notes.length} saved · Dropbox`}
      headerActions={
        <div className="flex items-center gap-1.5">
          {/* Quick type indicators */}
          <span className="hidden sm:flex items-center gap-1 rounded-lg border border-line/50 bg-surface-2/40 px-2 py-1 text-[11px] text-muted">
            <Sparkles className="h-3 w-3 text-amber-400" /> {counts.memory}
            <span className="opacity-40">•</span>
            <Mic className="h-3 w-3 text-rose-400" /> {counts.voice}
            <span className="opacity-40">•</span>
            <Globe className="h-3 w-3 text-sky-400" /> {counts.link}
          </span>
        </div>
      }
    >
      <div className="flex flex-1 flex-col gap-3 min-h-0">
        {/* ── Top Dropbox Intake Surface ── */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/40 p-2.5 transition-all shadow-sm">
          {/* Mode Pill Switcher */}
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex items-center gap-1">
              {[
                { id: 'note', label: 'Note', icon: FileText },
                { id: 'memory', label: 'Memory', icon: Sparkles },
                { id: 'voice', label: 'Voice', icon: Mic },
                { id: 'link', label: 'Link', icon: Globe },
              ].map((t) => {
                const Icon = t.icon
                const active = dropType === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setDropType(t.id)
                      playPop()
                    }}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all',
                      active
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>

            {dropType === 'voice' && (
              <span className="text-[10px] font-medium text-rose-400 flex items-center gap-1">
                <Radio className="h-3 w-3 animate-pulse" /> Audio recorder
              </span>
            )}
          </div>

          {/* Type-Specific Intake Forms */}
          {dropType === 'voice' ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-rose-500/30 bg-rose-500/5 p-3">
              {isRecording ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                    Recording: {formatDuration(recordSeconds)}
                  </div>
                  {voiceTranscript && (
                    <p className="max-h-16 overflow-y-auto text-center text-xs text-muted italic line-clamp-2">
                      "{voiceTranscript}"
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-rose-600 transition-all"
                    >
                      <Square className="h-3.5 w-3.5" /> Stop & Review
                    </button>
                    <button
                      onClick={cancelRecording}
                      className="rounded-xl border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : voiceDataUrl ? (
                <div className="w-full flex flex-col gap-2">
                  <VoicePlayer audioData={voiceDataUrl} duration={recordSeconds} />
                  <input
                    type="text"
                    value={dropTitle}
                    onChange={(e) => setDropTitle(e.target.value)}
                    placeholder="Title your voice recollection (optional)..."
                    className="w-full rounded-lg border border-line/60 bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                  />
                  {voiceTranscript && (
                    <textarea
                      value={voiceTranscript}
                      onChange={(e) => setVoiceTranscript(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-line/60 bg-surface px-2.5 py-1 text-xs outline-none focus:border-accent text-muted"
                      placeholder="Transcript..."
                    />
                  )}
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      onClick={cancelRecording}
                      className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-ink"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-accent/90"
                    >
                      <Check className="h-3.5 w-3.5" /> Save Voice Note
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-1">
                  <button
                    onClick={startRecording}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-white shadow-glow hover:scale-105 active:scale-95 transition-transform"
                    title="Start voice recording"
                  >
                    <Mic className="h-6 w-6" />
                  </button>
                  <span className="text-xs text-muted">Tap mic to record audio memo</span>
                </div>
              )}
            </div>
          ) : dropType === 'link' ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sky-400" />
                  <input
                    type="url"
                    value={dropUrl}
                    onChange={(e) => setDropUrl(e.target.value)}
                    placeholder="Paste link: https://..."
                    className="w-full rounded-xl border border-line/60 bg-surface pl-8 pr-3 py-1.5 text-xs outline-none focus:border-accent"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !dropUrl.trim()}
                  className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Drop
                </button>
              </div>
              <input
                type="text"
                value={dropTitle}
                onChange={(e) => setDropTitle(e.target.value)}
                placeholder="Title or note for this bookmark (optional)..."
                className="w-full rounded-lg border border-line/40 bg-surface/80 px-2.5 py-1 text-[11px] outline-none focus:border-accent"
              />
            </div>
          ) : (
            <form onSubmit={handleSave} className="flex flex-col gap-1.5">
              {dropType === 'memory' && (
                <input
                  type="text"
                  value={dropTitle}
                  onChange={(e) => setDropTitle(e.target.value)}
                  placeholder="Memory topic / moment title..."
                  className="w-full rounded-lg border border-line/60 bg-surface px-2.5 py-1 text-xs font-medium outline-none focus:border-accent"
                />
              )}
              <div className="flex gap-2">
                <textarea
                  value={dropText}
                  onChange={handleTextChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSave()
                    }
                  }}
                  rows={isHero ? 3 : 2}
                  placeholder={
                    dropType === 'memory'
                      ? 'Capture a memory or recollection you want to come back to...'
                      : 'Drop a random note, idea, scratchpad text, or paste a link...'
                  }
                  className="flex-1 resize-none rounded-xl border border-line/60 bg-surface px-3 py-1.5 text-xs outline-none focus:border-accent leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={isSaving || !dropText.trim()}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl bg-accent px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-accent/90 disabled:opacity-50 self-stretch"
                >
                  <Plus className="h-4 w-4" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recollections, voice notes, links..."
              className="w-full rounded-xl border border-line/50 bg-surface-2/30 pl-8 pr-7 py-1 text-xs outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            {['all', 'memory', 'voice', 'link', 'note'].map((k) => {
              const cfg = TYPE_CONFIG[k]
              const active = filterType === k
              return (
                <button
                  key={k}
                  onClick={() => setFilterType(k)}
                  className={cn(
                    'rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all',
                    active
                      ? 'bg-ink/15 text-ink border border-line font-bold'
                      : 'text-muted hover:text-ink',
                  )}
                >
                  {cfg.label}
                  {counts[k] > 0 && <span className="ml-1 opacity-60">({counts[k]})</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Notes Feed / Dropbox Items ── */}
        {filteredNotes.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line/60 py-6 text-center">
            <StickyNote className="h-6 w-6 text-muted" />
            <span className="text-xs text-muted">
              {searchQuery
                ? 'No notes matching search.'
                : filterType !== 'all'
                  ? `No ${TYPE_CONFIG[filterType]?.label.toLowerCase()} yet.`
                  : 'Your dropbox is empty. Drop thoughts, voice memos, links, or memories above.'}
            </span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
            {filteredNotes.map((n) => {
              const type = n.type || 'note'
              const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.note
              const Icon = cfg.icon

              return (
                <div
                  key={n.id}
                  className={cn(
                    'group relative flex flex-col gap-1.5 rounded-2xl border p-3 transition-all duration-200 backdrop-blur-md',
                    n.pinned
                      ? 'border-amber-500/40 bg-amber-500/5 shadow-sm'
                      : 'border-line/50 bg-surface-2/30 hover:border-accent/40 hover:bg-surface-2/50',
                  )}
                >
                  {/* Header Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px]',
                          cfg.color || 'text-muted bg-surface-2 border-line',
                        )}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <h4 className="truncate text-xs font-semibold text-ink">
                        {n.title || cfg.label}
                      </h4>
                      {n.pinned && (
                        <Pin className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] text-muted font-mono">
                        {n.createdAt?.toDate
                          ? n.createdAt.toDate().toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'Just now'}
                      </span>

                      {/* Action buttons on hover */}
                      <button
                        onClick={() => togglePinNote(user.uid, n.id, n.pinned)}
                        title={n.pinned ? 'Unpin' : 'Pin to top'}
                        className={cn(
                          'rounded p-1 transition-colors hover:bg-surface-2',
                          n.pinned
                            ? 'text-amber-400'
                            : 'text-muted opacity-0 group-hover:opacity-100',
                        )}
                      >
                        <Pin className="h-3 w-3" />
                      </button>

                      {type === 'link' && n.url && (
                        <a
                          href={n.url.startsWith('http') ? n.url : `https://${n.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open link"
                          className="rounded p-1 text-sky-400 hover:bg-sky-400/10 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}

                      <button
                        onClick={() =>
                          copyToClipboard(
                            type === 'link' ? n.url : n.content || n.title,
                            type === 'link' ? 'Link copied' : 'Note copied',
                          )
                        }
                        title="Copy"
                        className="rounded p-1 text-muted opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
                      >
                        <Copy className="h-3 w-3" />
                      </button>

                      <button
                        onClick={() => deleteNote(user.uid, n.id)}
                        title="Delete"
                        className="rounded p-1 text-muted opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Body Content by Type */}
                  {type === 'voice' && n.audioData && (
                    <VoicePlayer audioData={n.audioData} duration={n.audioDuration} />
                  )}

                  {type === 'voice' && n.transcript && (
                    <p className="text-xs text-muted/90 italic line-clamp-3 bg-surface/40 rounded-xl p-2 border border-line/30">
                      "{n.transcript}"
                    </p>
                  )}

                  {type === 'link' && (
                    <div className="flex flex-col gap-1">
                      <a
                        href={n.url.startsWith('http') ? n.url : `https://${n.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:underline break-all"
                      >
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate">{n.url}</span>
                      </a>
                      {n.content && n.content !== n.url && (
                        <p className="text-xs text-muted line-clamp-2">{n.content}</p>
                      )}
                    </div>
                  )}

                  {type === 'memory' && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
                      <p className="text-xs text-ink/90 whitespace-pre-wrap leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  )}

                  {type === 'note' && n.content && (
                    <p className="text-xs text-ink/90 whitespace-pre-wrap leading-relaxed line-clamp-4">
                      {n.content}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </WidgetFrame>
  )
}
