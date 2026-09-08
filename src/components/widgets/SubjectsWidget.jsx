import { useEffect, useState } from 'react'
import { Plus, Layers, ChevronLeft, Pencil } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useSubjects } from '@/hooks/useSubjects'
import { WidgetFrame } from './WidgetFrame'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SubjectDetail } from '@/components/subjects/SubjectDetail'
import { SubjectEditorModal } from '@/components/subjects/SubjectEditorModal'
import { cn } from '@/utils/cn'

export function SubjectsWidget({ widget, variant }) {
  const activeModeId = useStore((s) => s.activeModeId)
  const maximizeWidget = useStore((s) => s.maximizeWidget)
  const { subjects } = useSubjects(activeModeId)

  const [selectedId, setSelectedId] = useState(null)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)

  const isHero = variant === 'hero'
  const selected = subjects.find((s) => s.id === selectedId) || subjects[0] || null

  useEffect(() => {
    if (!selectedId && subjects.length) setSelectedId(subjects[0].id)
  }, [subjects, selectedId])

  const openCreate = () => {
    setEditingSubject(null)
    setEditorOpen(true)
  }

  const openEdit = (subject) => {
    setEditingSubject(subject)
    setEditorOpen(true)
  }

  const pickCompact = (subject) => {
    setSelectedId(subject.id)
    maximizeWidget('subjects')
  }

  return (
    <>
      <WidgetFrame
        widget={widget}
        variant={variant}
        subtitle={`${subjects.length} subjects`}
        headerActions={
          isHero ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted hover:text-ink transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Subject
            </button>
          ) : null
        }
      >
        {subjects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line/60 py-6 text-center">
            <Layers className="h-6 w-6 text-muted" />
            <span className="text-xs text-muted">No subjects yet.</span>
            <button onClick={openCreate} className="text-xs font-medium text-accent hover:underline">
              + Add your first subject
            </button>
          </div>
        ) : isHero ? (
          <div className="flex h-full gap-4">
            {/* Master rail (collapsible, persistent) */}
            <div
              className={cn(
                'flex shrink-0 flex-col transition-all duration-200',
                railCollapsed ? 'w-10' : 'w-56',
              )}
            >
              {/* Rail header with collapse toggle */}
              <div className="mb-2 flex items-center justify-between px-1">
                {!railCollapsed && (
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Subjects ({subjects.length})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setRailCollapsed((c) => !c)}
                  className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink transition-colors ml-auto"
                  title={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform duration-200', railCollapsed && 'rotate-180')} />
                </button>
              </div>

              {/* Subject list */}
              <div
                onDoubleClick={(e) => {
                  if (e.target === e.currentTarget) openCreate()
                }}
                className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5"
              >
                {subjects.map((s) =>
                  railCollapsed ? (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      title={`${s.name} (${s.progressPct || 0}%)`}
                      className={cn(
                        'flex items-center justify-center rounded-xl border p-2 transition-colors',
                        selected?.id === s.id
                          ? 'border-accent/50 bg-surface-2 shadow-xs'
                          : 'border-line/50 hover:border-accent/30',
                      )}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                    </button>
                  ) : (
                    <div
                      key={s.id}
                      className={cn(
                        'group/subrow rounded-xl border px-3 py-2 transition-colors',
                        selected?.id === s.id
                          ? 'border-accent/50 bg-surface-2 shadow-xs'
                          : 'border-line/50 hover:border-accent/30',
                      )}
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        <button
                          onClick={() => setSelectedId(s.id)}
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent"
                        >
                          {s.name}
                        </button>
                        <span className="text-[10px] text-muted">{s.progressPct || 0}%</span>
                        <button
                          onClick={() => openEdit(s)}
                          title="Edit subject & class times"
                          className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-ink group-hover/subrow:opacity-100"
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      <ProgressBar value={s.progressPct || 0} color={s.color} height="h-1.5" />
                    </div>
                  ),
                )}

                {/* Persistent add affordance at bottom of rail */}
                <button
                  onClick={openCreate}
                  className={cn(
                    'mt-1 flex items-center justify-center rounded-xl border border-dashed border-line/70 bg-surface-2/20 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-surface-2/40 hover:text-accent',
                    railCollapsed ? 'h-9 w-9 p-0' : 'gap-1.5 py-2 px-3',
                  )}
                  title="Add subject"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {!railCollapsed && <span>New Subject</span>}
                </button>
              </div>
            </div>

            {/* Expanded SubjectDetail on the right */}
            <div className="min-w-0 flex-1 border-l border-line/50 pl-4 overflow-y-auto">
              {selected ? (
                <SubjectDetail
                  modeId={selected._modeId || activeModeId}
                  subject={selected}
                  onEdit={() => openEdit(selected)}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted">
                  Select a subject
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Compact list (exhaustive, scrollable, double-click to add) */
          <div
            onDoubleClick={(e) => {
              if (e.target === e.currentTarget) openCreate()
            }}
            className="flex flex-1 flex-col gap-2 overflow-y-auto"
          >
            {subjects.map((s) => (
              <div
                key={s.id}
                className="group/subrow rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2 transition-colors hover:border-accent/40"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <button
                    onClick={() => pickCompact(s)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent"
                  >
                    {s.name}
                  </button>
                  <span className="text-[10px] text-muted">{s.progressPct || 0}%</span>
                  <button
                    onClick={() => openEdit(s)}
                    title="Edit subject & class times"
                    className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-ink group-hover/subrow:opacity-100"
                    aria-label={`Edit ${s.name}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                <ProgressBar value={s.progressPct || 0} color={s.color} height="h-1.5" />
              </div>
            ))}

            {/* Persistent add affordance at bottom of compact list */}
            <button
              onClick={openCreate}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-line/70 bg-surface-2/20 py-2 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:bg-surface-2/40 hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Subject
            </button>
          </div>
        )}
      </WidgetFrame>

      <SubjectEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        modeId={editingSubject?._modeId || activeModeId}
        subject={editingSubject}
        order={subjects.length}
        onDeleted={(id) => {
          if (selectedId === id) setSelectedId(null)
        }}
      />
    </>
  )
}
