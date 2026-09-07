import { AnimatePresence, motion } from 'framer-motion'
import { X, ExternalLink, Bell, CalendarClock, Mic, Sparkles, Globe, FileText, StickyNote } from 'lucide-react'
import { VoicePlayer } from '@/components/notes/VoicePlayer'
import { classifyDeadline } from '@/lib/deadlines'
import { cn } from '@/utils/cn'

const NOTE_META = {
  voice: { Icon: Mic, label: 'Voice memo', color: 'text-rose-400' },
  memory: { Icon: Sparkles, label: 'Memory', color: 'text-amber-400' },
  link: { Icon: Globe, label: 'Saved link', color: 'text-sky-400' },
  note: { Icon: FileText, label: 'Note', color: 'text-emerald-400' },
}

function formatDeadline(dueAt) {
  if (!dueAt) return ''
  const d = dueAt?.toDate ? dueAt.toDate() : new Date(dueAt)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Modal shown when a note's timetable deadline chip is clicked. Text/memory
 * notes are viewable; voice notes are playable inline; links open externally.
 *
 * @param {{ note: object|null, onClose: () => void }} props
 */
export function NoteDeadlinePeek({ note, onClose }) {
  const meta = (note && NOTE_META[note.type]) || NOTE_META.note
  const overdue = note && classifyDeadline(note.dueAt) === 'overdue'
  const { Icon } = meta

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.94, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 14, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-md flex-col gap-3 rounded-3xl border border-white/10 bg-surface/95 p-5 shadow-glass-lg"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/10 hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-2 pr-6">
              <span className={cn('mt-0.5 shrink-0', meta.color)}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-ink">
                  {note.title || meta.label}
                </h3>
                <span className="text-[11px] uppercase tracking-wide text-muted">{meta.label}</span>
              </div>
            </div>

            {/* Deadline banner */}
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium',
                overdue
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-violet-500/30 bg-violet-500/10 text-violet-300',
              )}
            >
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span>{overdue ? 'Overdue · ' : 'Due · '}{formatDeadline(note.dueAt)}</span>
              {note.reminderEnabled && (
                <span className="ml-auto flex items-center gap-1 text-amber-400" title="Reminder set (2 days ahead)">
                  <Bell className="h-3.5 w-3.5" />
                </span>
              )}
            </div>

            {/* Body */}
            {note.type === 'voice' && note.audioData ? (
              <div className="flex flex-col gap-2">
                <VoicePlayer audioData={note.audioData} duration={note.audioDuration || 0} />
                {note.transcript && (
                  <p className="rounded-xl border border-line/50 bg-surface-2/40 p-2.5 text-xs italic text-muted">
                    "{note.transcript}"
                  </p>
                )}
              </div>
            ) : note.type === 'link' && note.url ? (
              <a
                href={note.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-line/50 bg-surface-2/40 p-2.5 text-xs text-sky-400 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{note.url}</span>
              </a>
            ) : note.content ? (
              <p className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/50 bg-surface-2/40 p-3 text-sm leading-relaxed text-ink">
                {note.content}
              </p>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-line/50 bg-surface-2/40 p-3 text-xs text-muted">
                <StickyNote className="h-3.5 w-3.5" /> No additional content.
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
