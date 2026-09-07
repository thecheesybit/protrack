import { memo } from 'react'
import { Mic, Sparkles, Globe, FileText, StickyNote } from 'lucide-react'
import { classifyDeadline } from '@/lib/deadlines'
import { cn } from '@/utils/cn'

const NOTE_ICON = {
  voice: Mic,
  memory: Sparkles,
  link: Globe,
  note: FileText,
}

/**
 * A blinking, clickable chip marking a note's deadline on the day it falls on.
 * Clicking calls `onOpen(note)` so the parent can show a peek (text viewable /
 * voice playable). Overdue notes glow rose, upcoming ones amber.
 *
 * @param {{ note: object, topPx: number, onOpen: (note: object) => void }} props
 */
export const NoteDeadlineChip = memo(function NoteDeadlineChip({ note, topPx, onOpen }) {
  const Icon = NOTE_ICON[note.type] || StickyNote
  const overdue = classifyDeadline(note.dueAt) === 'overdue'

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.(note)
      }}
      title={`${note.title || 'Note'} — deadline (click to view)`}
      className={cn(
        'group/note absolute left-0.5 z-10 flex max-w-[92%] items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold shadow-sm transition-all hover:scale-105',
        overdue
          ? 'bg-rose-500/95 text-white ring-1 ring-rose-300/60'
          : 'bg-violet-500/95 text-white ring-1 ring-violet-300/50',
      )}
      style={{ top: Math.max(0, topPx - 8) }}
    >
      {/* Blinking indicator */}
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 animate-pulse rounded-full',
          overdue ? 'bg-rose-200' : 'bg-violet-200',
        )}
      />
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{note.title || 'Note'}</span>
    </button>
  )
})
