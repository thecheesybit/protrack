import { useState } from 'react'
import { Pencil, Plus, ExternalLink, X, Flag, Minus, Play } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MicroKanban } from './MicroKanban'
import {
  adjustProgress,
  addSubjectLink,
  removeSubjectLink,
  addSubjectFlag,
  removeSubjectFlag,
} from '@/services/subjectService'
import { cn } from '@/utils/cn'

export function SubjectDetail({ modeId, subject, onEdit }) {
  const { user } = useAuth()
  const openFocus = useStore((s) => s.openFocus)
  const [linkForm, setLinkForm] = useState(null) // {label,url} | null
  const [flagText, setFlagText] = useState(null) // string | null

  const links = subject.links || []
  const flags = subject.flags || []
  const progress = subject.progressPct || 0

  // Atomic increment so concurrent +/- from two devices merge correctly.
  const bumpProgress = (delta) => adjustProgress(user.uid, modeId, subject.id, delta)

  const addLink = () => {
    if (!linkForm?.url?.trim()) return setLinkForm(null)
    const url = linkForm.url.trim()
    addSubjectLink(user.uid, modeId, subject.id, {
      label: linkForm.label?.trim() || url,
      url: url.startsWith('http') ? url : `https://${url}`,
    })
    setLinkForm(null)
  }
  const removeLink = (link) => removeSubjectLink(user.uid, modeId, subject.id, link)

  const addFlag = () => {
    if (!flagText?.trim()) return setFlagText(null)
    addSubjectFlag(user.uid, modeId, subject.id, { type: 'pending_note', note: flagText.trim() })
    setFlagText(null)
  }
  const removeFlag = (flag) => removeSubjectFlag(user.uid, modeId, subject.id, flag)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: subject.color }} />
        <h3 className="min-w-0 flex-1 truncate text-lg font-bold">{subject.name}</h3>
        <button
          onClick={() =>
            openFocus({
              title: subject.name,
              subtitle: 'Subject deep work',
              color: subject.color,
              subjectId: subject.id,
            })
          }
          className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
        >
          <Play className="h-3.5 w-3.5" /> Focus
        </button>
        <button
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Edit subject"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted">Progress</span>
          <span className="font-semibold">{progress}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => bumpProgress(-5)}
            disabled={progress <= 0}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-muted hover:text-ink disabled:opacity-40"
          >
            <Minus className="h-3 w-3" />
          </button>
          <ProgressBar value={progress} color={subject.color} />
          <button
            onClick={() => bumpProgress(5)}
            disabled={progress >= 100}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-line text-muted hover:text-ink disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Links + Flags */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Links */}
        <div className="rounded-xl border border-line/50 bg-surface-2/30 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Links</span>
            <button onClick={() => setLinkForm({ label: '', url: '' })} className="text-muted hover:text-ink">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {links.map((l, i) => (
              <div key={i} className="group/link flex items-center gap-1.5 text-xs">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-1 truncate text-accent hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{l.label}</span>
                </a>
                <button onClick={() => removeLink(l)} className="opacity-0 group-hover/link:opacity-100">
                  <X className="h-3 w-3 text-muted" />
                </button>
              </div>
            ))}
            {linkForm && (
              <div className="mt-1 flex flex-col gap-1">
                <input
                  autoFocus
                  value={linkForm.label}
                  onChange={(e) => setLinkForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Label"
                  className="rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                />
                <input
                  value={linkForm.url}
                  onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                  onBlur={addLink}
                  placeholder="https://…"
                  className="rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                />
              </div>
            )}
            {!links.length && !linkForm && (
              <span className="text-[11px] text-muted">No links yet.</span>
            )}
          </div>
        </div>

        {/* Flags */}
        <div className="rounded-xl border border-line/50 bg-surface-2/30 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Pending notes</span>
            <button onClick={() => setFlagText('')} className="text-muted hover:text-ink">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {flags.map((f, i) => (
              <div key={i} className="group/flag flex items-center gap-1.5 text-xs">
                <Flag className="h-3 w-3 shrink-0 text-amber-400" />
                <span className="min-w-0 flex-1 truncate">{f.note}</span>
                <button onClick={() => removeFlag(f)} className="opacity-0 group-hover/flag:opacity-100">
                  <X className="h-3 w-3 text-muted" />
                </button>
              </div>
            ))}
            {flagText !== null && (
              <input
                autoFocus
                value={flagText}
                onChange={(e) => setFlagText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFlag()}
                onBlur={addFlag}
                placeholder="What's pending?"
                className="mt-1 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
              />
            )}
            {!flags.length && flagText === null && (
              <span className="text-[11px] text-muted">All caught up.</span>
            )}
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className={cn('mt-4 flex min-h-0 flex-1 flex-col')}>
        <span className="mb-2 text-xs font-medium text-muted">Tasks</span>
        <div className="min-h-0 flex-1">
          <MicroKanban modeId={modeId} subjectId={subject.id} subjectName={subject.name} />
        </div>
      </div>
    </div>
  )
}
