import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CalendarCheck, CalendarPlus, RefreshCw, Flame, Clock, CalendarDays, LayoutGrid, CalendarRange, Calendar as CalendarIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useTimetable } from '@/hooks/useTimetable'
import { useTodos } from '@/hooks/useWellness'
import { useNotes } from '@/hooks/useNotes'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { useModeTasksWithDates } from '@/hooks/useModeTasksWithDates'
import { WidgetFrame } from './WidgetFrame'
import { cn } from '@/utils/cn'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import { TodayAgenda } from '@/components/timetable/TodayAgenda'
import { MonthAgenda } from '@/components/timetable/MonthAgenda'
import { NoteDeadlinePeek } from '@/components/timetable/NoteDeadlinePeek'
import { SlotEditorModal } from '@/components/timetable/SlotEditorModal'
import { NlQuickCapture } from '@/components/calendar/NlQuickCapture'
import { TimeContextPanel } from '@/components/timetable/TimeContextPanel'
import { updateTodo, deleteTodo } from '@/services/todoService'
import { updateTask } from '@/services/subjectService'
import { MODE_PALETTE } from '@/lib/constants'
import { DAY_START_MIN, todayDow, minutesToLabel, durationLabel } from '@/lib/time'
import { ymd } from '@/lib/dates'
import { openItemCounts } from '@/lib/counts'
import {
  connectCalendar,
  isCalendarConnected,
} from '@/services/calendarService'
import { GCAL_SYNC_NOW_EVENT } from '@/hooks/useCalendarSync'

function toDate(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') return ts.toDate()
  return new Date(ts)
}

function CompactStats({ sessions, stats }) {
  const todayMins = useMemo(() => {
    const key = ymd()
    return sessions.reduce((acc, s) => {
      const d = toDate(s.startedAt)
      return d && ymd(d) === key ? acc + (s.durationMin || 0) : acc
    }, 0)
  }, [sessions])

  const todaySessions = useMemo(() => {
    const key = ymd()
    return sessions.filter((s) => {
      const d = toDate(s.startedAt)
      return d && ymd(d) === key
    }).length
  }, [sessions])

  const streak = stats?.currentStreak || 0

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-line/40 pt-2 mt-1">
      <span className="flex items-center gap-1 text-[10px] text-muted">
        <Flame className="h-3 w-3 text-amber-400" />
        {streak}d streak
      </span>
      <span className="flex items-center gap-1 text-[10px] text-muted">
        <Clock className="h-3 w-3 text-accent/70" />
        {todayMins}m today
      </span>
      <span className="flex items-center gap-1 text-[10px] text-muted">
        <CalendarDays className="h-3 w-3 text-accent/70" />
        {todaySessions} session{todaySessions !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

export function TimetableWidget({ widget, variant }) {
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const stats = useStore((s) => s.stats)
  const openFocus = useStore((s) => s.openFocus)
  const { slots } = useTimetable(activeModeId)
  const { sessions } = useFocusSessions()

  const todos = useTodos()
  const notes = useNotes()
  // Kanban tasks that have a day/time → show on the timeline & month views.
  const subjectDueTasks = useModeTasksWithDates(activeModeId)
  const activeMode = modes.find((m) => m.id === activeModeId)
  const defaultColor = activeMode?.accentColor || MODE_PALETTE[0]

  const [peekNote, setPeekNote] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  const [captureSeed, setCaptureSeed] = useState(null)
  const [connected, setConnected] = useState(isCalendarConnected())
  const [selection, setSelection] = useState(null) // { dayIndex, startMin, endMin }
  const { user } = useAuth()

  // Pulled Google Calendar events (all calendars) — local cache in gcalSlice.
  const gcalEvents = useStore((s) => s.gcalEvents)
  const calEvents = useMemo(() => {
    const now = Date.now()
    return (gcalEvents || [])
      .filter((e) => (e.endMs || e.startMs || 0) >= now - 3600_000)
      .sort((a, b) => (a.startMs || 0) - (b.startMs || 0))
      .slice(0, 30)
  }, [gcalEvents])

  const isHero = variant === 'hero'

  const handleToggleTask = (t) => {
    if (!user) return
    updateTodo(user.uid, t.id, { done: !t.done })
  }

  const handleDeleteTask = (id) => {
    if (!user) return
    deleteTodo(user.uid, id)
    toast.success('Task removed')
  }

  const handleDeleteEvent = (id) => {
    if (!user) return
    deleteTodo(user.uid, id)
    toast.success('Event removed')
  }

  const handleToggleSubjectTask = (t) => {
    if (!user || !t?.subjectId) return
    const done = t.column === 'done' || t.done
    updateTask(user.uid, t._modeId || activeModeId, t.subjectId, t.id, {
      column: done ? 'todo' : 'done',
    })
  }

  // "Refresh" just asks useCalendarSync (mounted in Dashboard) to run now; the
  // pulled events flow back through the gcalSlice cache.
  const refreshEvents = () => {
    if (isCalendarConnected()) window.dispatchEvent(new Event(GCAL_SYNC_NOW_EVENT))
  }

  const connect = async () => {
    try {
      await connectCalendar()
      setConnected(true)
      toast.success('Google Calendar connected')
      refreshEvents()
    } catch (err) {
      toast.error(err.message)
    }
  }

  // When already connected, the header button triggers an immediate two-way
  // sync (useCalendarSync, mounted in Dashboard, listens for this event).
  const connectOrSync = () => {
    if (isCalendarConnected()) {
      window.dispatchEvent(new Event(GCAL_SYNC_NOW_EVENT))
      toast.success('Syncing Google Calendar…')
      refreshEvents()
    } else {
      connect()
    }
  }

  const openEditor = (slot) => {
    setEditingSlot(slot)
    setEditorOpen(true)
  }
  const openSlotFocus = (slot) => {
    const durMin = Math.max(5, (slot.endMin || 0) - (slot.startMin || 0))
    openFocus({
      title: slot.label || 'Study session',
      subtitle: `${minutesToLabel(slot.startMin)} · ${durationLabel(slot.startMin, slot.endMin)}`,
      color: slot.color,
      slotId: slot.id,
      durationMin: durMin,
    })
  }
  const quickAdd = (startMin, endMin, dayIndex) =>
    openEditor({
      dayOfWeek: dayIndex ?? todayDow(),
      startMin: startMin ?? DAY_START_MIN + 3 * 60,
      endMin: endMin ?? DAY_START_MIN + 4 * 60,
      label: '',
      color: defaultColor,
    })

  const handleSelect = (sel) => setSelection(sel)

  const handleCreateSlotFromPanel = (data) => {
    const sel = data || selection
    if (!sel) return
    openEditor({
      dayOfWeek: sel.dayIndex,
      startMin: sel.startMin,
      endMin: sel.endMin,
      label: '',
      color: defaultColor,
    })
  }

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('protrack:timetable_widget_view') || 'week'
    } catch {
      return 'week'
    }
  })

  const handleSetViewMode = (mode) => {
    setViewMode(mode)
    try {
      localStorage.setItem('protrack:timetable_widget_view', mode)
    } catch { /* noop */ }
  }

  // Clicking a weekday header in Week view → open that date in the Day view.
  const [pickedDate, setPickedDate] = useState(null)
  const pickDay = (date) => {
    setPickedDate(date instanceof Date ? new Date(date) : new Date())
    handleSetViewMode('day')
  }

  // Scope todos: all modes if 'all', or matching active mode + unassigned global todos
  const activeTodos = useMemo(() => {
    return todos.filter(
      (t) => !t.done && (activeModeId === 'all' || !t.modeId || t.modeId === activeModeId),
    )
  }, [todos, activeModeId])

  // Partition todos: events (type='event') vs deadline chips
  const eventTodos = useMemo(
    () => activeTodos.filter((t) => t.type === 'event'),
    [activeTodos],
  )
  const chipTodos = useMemo(
    () => activeTodos.filter((t) => t.dueAt && t.type !== 'event'),
    [activeTodos],
  )

  // Notes carrying a deadline — surfaced as blinking chips on their due day,
  // scoped like todos (all modes when 'all', otherwise this mode + global).
  const noteDeadlines = useMemo(
    () =>
      notes.filter(
        (n) => n.dueAt && (activeModeId === 'all' || !n.modeId || n.modeId === activeModeId),
      ),
    [notes, activeModeId],
  )

  // Open items counter for header (P11)
  // Deferred by owner: AI "realistic timeline" suggestions are intentionally out
  // of scope for the counter (see roadmap P11).
  const itemCounts = useMemo(
    () => openItemCounts({ todos: activeTodos, events: eventTodos, date: new Date() }),
    [activeTodos, eventTodos],
  )

  const headerActions = (
    <div className="flex items-center gap-1.5">
      {/* Clickable open items counter pill (P11) */}
      <button
        type="button"
        onClick={() => handleSetViewMode('day')}
        className="flex items-center gap-1 rounded-xl border border-white/10 bg-surface-2/40 px-2 py-1 text-[10px] font-medium text-muted hover:text-ink hover:border-accent/40 transition-all backdrop-blur-md"
        title="Click to view day agenda"
      >
        <span className="font-semibold text-accent">{itemCounts.openTodos} open</span>
        <span>·</span>
        <span>{itemCounts.eventsToday} today</span>
        {itemCounts.overdue > 0 && (
          <>
            <span>·</span>
            <span className="font-semibold text-rose-400">{itemCounts.overdue} overdue</span>
          </>
        )}
      </button>

      {/* View switcher: Day vs Week calendar */}
      {!isHero && (
        <div className="flex items-center rounded-xl border border-white/10 bg-surface-2/40 p-0.5 text-[11px] font-medium backdrop-blur-md">
          <button
            onClick={() => handleSetViewMode('week')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
              viewMode === 'week'
                ? 'bg-surface shadow-glass font-bold text-accent'
                : 'text-muted hover:text-ink',
            )}
            title="Full Week Calendar view"
          >
            <LayoutGrid className="h-3 w-3" />
            Week
          </button>
          <button
            onClick={() => handleSetViewMode('day')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
              viewMode === 'day'
                ? 'bg-surface shadow-glass font-bold text-accent'
                : 'text-muted hover:text-ink',
            )}
            title="Single Day Agenda view"
          >
            <CalendarIcon className="h-3 w-3" />
            Day
          </button>
          <button
            onClick={() => handleSetViewMode('month')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all',
              viewMode === 'month'
                ? 'bg-surface shadow-glass font-bold text-accent'
                : 'text-muted hover:text-ink',
            )}
            title="Month-by-month Google Calendar agenda"
          >
            <CalendarRange className="h-3 w-3" />
            Month
          </button>
        </div>
      )}

      {isHero && (
        <button
          onClick={connectOrSync}
          title={connected ? 'Sync Google Calendar now' : 'Connect Google Calendar'}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-ink"
        >
          {connected ? (
            <>
              <CalendarCheck className="h-3.5 w-3.5 text-emerald-400" /> Synced
            </>
          ) : (
            <>
              <CalendarPlus className="h-3.5 w-3.5" /> Calendar
            </>
          )}
        </button>
      )}
    </div>
  )

  return (
    <>
      <WidgetFrame
        widget={widget}
        variant={variant}
        subtitle={
          activeModeId === 'all'
            ? `${slots.length} sessions / week · All Scopes`
            : `${slots.length} sessions / week${activeMode ? ` · ${activeMode.name}` : ''}`
        }
        headerActions={headerActions}
      >
        {isHero ? (
          <div className="flex h-full gap-4">
            <div className="flex min-w-0 flex-1 flex-col">
              <TimetableGrid
                slots={slots}
                events={eventTodos}
                defaultColor={defaultColor}
                onSelect={handleSelect}
                onOpenSlot={openSlotFocus}
                onEditSlot={openEditor}
                onQuickCapture={setCaptureSeed}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onDeleteEvent={handleDeleteEvent}
                dateTasks={chipTodos}
                noteDeadlines={noteDeadlines}
                onOpenNote={setPeekNote}
                gcalEvents={gcalEvents}
                onPickDay={pickDay}

                subjectTasks={subjectDueTasks}

                onToggleSubjectTask={handleToggleSubjectTask}
                allTodos={activeTodos}
                sessions={sessions}
              />
            </div>

            {connected && (
              <div className="hidden w-56 shrink-0 flex-col xl:flex">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">From Google</span>
                  <button
                    onClick={refreshEvents}
                    className="text-muted hover:text-ink"
                    aria-label="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 overflow-y-auto">
                  {calEvents.length === 0 && (
                    <span className="text-xs text-muted">No upcoming events.</span>
                  )}
                  {calEvents.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-lg border border-line/50 bg-surface-2/40 px-2.5 py-1.5"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: e.color }}
                        />
                        <span className="block truncate text-xs font-medium">{e.title || '(busy)'}</span>
                      </span>
                      <span className="text-[10px] text-muted">
                        {e.allDay
                          ? new Date(e.startMs).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                          : new Date(e.startMs).toLocaleString([], {
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {viewMode === 'week' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <TimetableGrid
                  slots={slots}
                  events={eventTodos}
                  defaultColor={defaultColor}
                  onSelect={handleSelect}
                  onOpenSlot={openSlotFocus}
                  onEditSlot={openEditor}
                  onQuickCapture={setCaptureSeed}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onDeleteEvent={handleDeleteEvent}
                  dateTasks={chipTodos}
                  noteDeadlines={noteDeadlines}
                  onOpenNote={setPeekNote}
                  gcalEvents={gcalEvents}
                  onPickDay={pickDay}

                  subjectTasks={subjectDueTasks}

                  onToggleSubjectTask={handleToggleSubjectTask}
                  allTodos={activeTodos}
                  sessions={sessions}
                  compact
                />
              </div>
            ) : viewMode === 'month' ? (
              <MonthAgenda
                slots={slots}
                events={eventTodos}
                todos={activeTodos}
                tasks={subjectDueTasks}
                noteDeadlines={noteDeadlines}
                sessions={sessions}
              />
            ) : (
              <TodayAgenda
                slots={slots}
                events={eventTodos}
                dateTasks={chipTodos}
                tasks={subjectDueTasks}
                gcalEvents={gcalEvents}
                initialDate={pickedDate}
                noteDeadlines={noteDeadlines}
                onOpenNote={setPeekNote}
                allTodos={activeTodos}
                sessions={sessions}
                onOpenSlot={openSlotFocus}
                onAdd={quickAdd}
                onSelect={handleSelect}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onDeleteEvent={handleDeleteEvent}
              />
            )}
            {viewMode !== 'month' && <CompactStats sessions={sessions} stats={stats} />}
          </div>
        )}
      </WidgetFrame>

      <SlotEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        modeId={editingSlot?._modeId || (activeModeId === 'all' ? modes[0]?.id : activeModeId)}
        slot={editingSlot}
        allModes={activeModeId === 'all' ? modes : undefined}
      />

      <NlQuickCapture
        open={Boolean(captureSeed)}
        onClose={() => setCaptureSeed(null)}
        seed={captureSeed}
        modeId={activeModeId}
        defaultColor={defaultColor}
      />

      <NoteDeadlinePeek note={peekNote} onClose={() => setPeekNote(null)} />

      <AnimatePresence>
        {selection && (
          <TimeContextPanel
            dayIndex={selection.dayIndex}
            startMin={selection.startMin}
            endMin={selection.endMin}
            slots={slots}
            todos={todos}
            modeId={activeModeId === 'all' ? (modes[0]?.id || null) : activeModeId}
            onClose={() => setSelection(null)}
            onCreateSlot={handleCreateSlotFromPanel}
          />
        )}
      </AnimatePresence>
    </>
  )
}
