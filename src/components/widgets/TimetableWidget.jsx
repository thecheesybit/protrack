import { useEffect, useState } from 'react'
import { CalendarCheck, CalendarPlus, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { useTimetable } from '@/hooks/useTimetable'
import { useTodos } from '@/hooks/useWellness'
import { WidgetFrame } from './WidgetFrame'
import { TimetableGrid } from '@/components/timetable/TimetableGrid'
import { TodayAgenda } from '@/components/timetable/TodayAgenda'
import { SlotEditorModal } from '@/components/timetable/SlotEditorModal'
import { NlQuickCapture } from '@/components/calendar/NlQuickCapture'
import { MODE_PALETTE } from '@/lib/constants'
import { DAY_START_MIN, todayDow, minutesToLabel, durationLabel } from '@/lib/time'
import {
  connectCalendar,
  isCalendarConnected,
  listUpcomingEvents,
} from '@/services/calendarService'

export function TimetableWidget({ widget, variant }) {
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const openFocus = useStore((s) => s.openFocus)
  const { slots } = useTimetable(activeModeId)

  const todos = useTodos()
  const activeMode = modes.find((m) => m.id === activeModeId)
  const defaultColor = activeMode?.accentColor || MODE_PALETTE[0]

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  const [captureSeed, setCaptureSeed] = useState(null)
  const [connected, setConnected] = useState(isCalendarConnected())
  const [events, setEvents] = useState([])

  const isHero = variant === 'hero'

  const refreshEvents = async () => {
    try {
      setEvents(await listUpcomingEvents())
    } catch (err) {
      if (!isCalendarConnected()) setConnected(false)
      toast.error(err.message)
    }
  }

  useEffect(() => {
    if (isHero && connected) refreshEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHero])

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

  const openEditor = (slot) => {
    if (!slot.id && activeModeId === 'all') {
      toast.error('Please select a specific mode to add sessions.')
      return
    }
    setEditingSlot(slot)
    setEditorOpen(true)
  }
  const openSlotFocus = (slot) => {
    openFocus({
      title: slot.label || 'Study session',
      subtitle: `${minutesToLabel(slot.startMin)} · ${durationLabel(slot.startMin, slot.endMin)}`,
      color: slot.color,
      slotId: slot.id,
    })
  }
  const quickAdd = () =>
    openEditor({
      dayOfWeek: todayDow(),
      startMin: DAY_START_MIN + 3 * 60,
      endMin: DAY_START_MIN + 4 * 60,
      label: '',
      color: defaultColor,
    })

  const headerActions = isHero ? (
    <button
      onClick={connect}
      title="Connect Google Calendar"
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
  ) : null

  return (
    <>
      <WidgetFrame
        widget={widget}
        variant={variant}
        subtitle={`${slots.length} sessions / week`}
        headerActions={headerActions}
      >
        {isHero ? (
          <div className="flex h-full gap-4">
            <div className="flex min-w-0 flex-1 flex-col">
              <TimetableGrid
                slots={slots}
                defaultColor={defaultColor}
                onCreate={openEditor}
                onOpenSlot={openSlotFocus}
                onEditSlot={openEditor}
                onQuickCapture={setCaptureSeed}
                dateTasks={todos.filter((t) => !t.done && t.dueAt)}
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
                  {events.length === 0 && (
                    <span className="text-xs text-muted">No upcoming events.</span>
                  )}
                  {events.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-lg border border-line/50 bg-surface-2/40 px-2.5 py-1.5"
                    >
                      <span className="block truncate text-xs font-medium">
                        {e.summary || '(busy)'}
                      </span>
                      <span className="text-[10px] text-muted">
                        {e.start?.dateTime
                          ? new Date(e.start.dateTime).toLocaleString([], {
                              weekday: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : e.start?.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <TodayAgenda slots={slots} onOpenSlot={openSlotFocus} onAdd={quickAdd} />
        )}
      </WidgetFrame>

      <SlotEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        modeId={editingSlot?._modeId || (activeModeId === 'all' ? modes[0]?.id : activeModeId)}
        slot={editingSlot}
      />

      <NlQuickCapture
        open={Boolean(captureSeed)}
        onClose={() => setCaptureSeed(null)}
        seed={captureSeed}
        modeId={activeModeId}
        defaultColor={defaultColor}
      />
    </>
  )
}
