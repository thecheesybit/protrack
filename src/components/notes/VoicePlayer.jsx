import { useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/**
 * Self-contained audio player for recorded voice notes. Extracted from
 * NotesWidget so both the notes list and the timetable deadline peek can reuse
 * a single, consistent player.
 *
 * @param {{ audioData: string, duration: number }} props
 */
export function VoicePlayer({ audioData, duration }) {
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
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch((err) => {
          console.warn('Audio playback failed', err)
          toast.error('Unable to play audio recording')
        })
    }
  }

  const onTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
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
          playing ? 'bg-rose-500 text-white animate-pulse' : 'bg-accent text-white hover:scale-105',
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
