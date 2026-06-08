import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Layers, ArrowLeft } from 'lucide-react'
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
  const [fullDetail, setFullDetail] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState(null)

  const isHero = variant === 'hero'
  const selected = subjects.find((s) => s.id === selectedId) || subjects[0] || null

  useEffect(() => {
    if (!selectedId && subjects.length) setSelectedId(subjects[0].id)
  }, [subjects, selectedId])

  // Exit full-detail when leaving hero mode
  useEffect(() => {
    if (!isHero) setFullDetail(false)
  }, [isHero])

  const openCreate = () => {
    if (activeModeId === 'all') {
      toast.error('Please select a specific mode to add subjects.')
      return
    }
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
  const openFullDetail = (subject) => {
    setSelectedId(subject.id)
    setFullDetail(true)
  }

  return (
    <>
      <WidgetFrame
        widget={widget}
        variant={variant}
        subtitle={`${subjects.length} subjects`}
        headerActions={
          isHero ? (
            fullDetail ? (
              <button
                onClick={() => setFullDetail(false)}
                className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> All subjects
              </button>
            ) : (
              <button
                onClick={openCreate}
                className="flex items-center gap-1 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted hover:text-ink"
              >
                <Plus className="h-3.5 w-3.5" /> Subject
              </button>
            )
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
          fullDetail && selected ? (
            /* Full-screen detail — no sidebar */
            <div className="flex h-full min-h-0 flex-col overflow-y-auto">
              <SubjectDetail
                modeId={selected._modeId || activeModeId}
                subject={selected}
                onEdit={() => openEdit(selected)}
              />
            </div>
          ) : (
            <div className="flex h-full gap-4">
              {/* Master list */}
              <div className="flex w-52 shrink-0 flex-col gap-1.5 overflow-y-auto">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openFullDetail(s)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      selected?.id === s.id
                        ? 'border-accent/50 bg-surface-2'
                        : 'border-line/50 hover:border-accent/30',
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                      <span className="text-[10px] text-muted">{s.progressPct || 0}%</span>
                    </div>
                    <ProgressBar value={s.progressPct || 0} color={s.color} height="h-1.5" />
                  </button>
                ))}
              </div>
              {/* Preview detail — click subject card to go full-screen */}
              <div className="min-w-0 flex-1 border-l border-line/50 pl-4">
                {selected && (
                  <SubjectDetail
                    modeId={selected._modeId || activeModeId}
                    subject={selected}
                    onEdit={() => openEdit(selected)}
                  />
                )}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {subjects.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => pickCompact(s)}
                className="rounded-xl border border-line/50 bg-surface-2/30 px-3 py-2 text-left transition-colors hover:border-accent/40"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                  <span className="text-[10px] text-muted">{s.progressPct || 0}%</span>
                </div>
                <ProgressBar value={s.progressPct || 0} color={s.color} height="h-1.5" />
              </button>
            ))}
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
