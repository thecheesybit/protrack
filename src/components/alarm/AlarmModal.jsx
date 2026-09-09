import { useState, useEffect, useMemo } from 'react'
import {
  Bell,
  BellRing,
  Clock,
  Calendar,
  Volume2,
  Trash2,
  Plus,
  Play,
  Check,
  RotateCw,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import {
  getAlarms,
  createAlarm,
  deleteAlarm,
  toggleAlarm,
  formatTime12h,
  to24hTime,
  timeRemainingLabel,
  ALARMS_CHANGED_EVENT,
  ALARM_SOUND_OPTIONS,
  PRESET_LABELS,
} from '@/services/alarmService'
import { playSound } from '@/lib/sound'
import { cn } from '@/utils/cn'

export function AlarmModal({ open, onClose }) {
  const [alarms, setAlarms] = useState(() => getAlarms())

  // Form State
  const [hour12, setHour12] = useState('08')
  const [minute, setMinute] = useState('00')
  const [period, setPeriod] = useState('AM')
  const [label, setLabel] = useState('')
  const [repeat, setRepeat] = useState('once')
  const [sound, setSound] = useState('alarm')
  const [visibleOnCalendar, setVisibleOnCalendar] = useState(true)

  // Sync alarms when storage changes
  useEffect(() => {
    if (!open) return
    const sync = () => setAlarms(getAlarms())
    window.addEventListener(ALARMS_CHANGED_EVENT, sync)
    sync()
    return () => window.removeEventListener(ALARMS_CHANGED_EVENT, sync)
  }, [open])

  // Initialize time picker to next nearest 15-minute slot on open
  useEffect(() => {
    if (open) {
      const now = new Date()
      now.setMinutes(Math.ceil((now.getMinutes() + 10) / 15) * 15)
      const h = now.getHours()
      const p = h >= 12 ? 'PM' : 'AM'
      let h12 = h % 12
      if (h12 === 0) h12 = 12
      setHour12(String(h12).padStart(2, '0'))
      setMinute(String(now.getMinutes()).padStart(2, '0'))
      setPeriod(p)
      setLabel('')
    }
  }, [open])

  // Quick preset offset handlers
  const handleAddMinutes = (mins) => {
    const d = new Date()
    d.setMinutes(d.getMinutes() + mins)
    const h = d.getHours()
    const p = h >= 12 ? 'PM' : 'AM'
    let h12 = h % 12
    if (h12 === 0) h12 = 12
    setHour12(String(h12).padStart(2, '0'))
    setMinute(String(d.getMinutes()).padStart(2, '0'))
    setPeriod(p)
  }

  const handleNextTopHour = () => {
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    const h = d.getHours()
    const p = h >= 12 ? 'PM' : 'AM'
    let h12 = h % 12
    if (h12 === 0) h12 = 12
    setHour12(String(h12).padStart(2, '0'))
    setMinute('00')
    setPeriod(p)
  }

  const handlePreviewSound = (sName) => {
    playSound(sName)
  }

  const handleCreate = (e) => {
    e.preventDefault()
    const time24 = to24hTime(hour12, minute, period)
    const newAlarm = createAlarm({
      time: time24,
      label: label.trim() || 'Alarm Reminder',
      enabled: true,
      repeat,
      sound,
      visibleOnCalendar,
    })

    toast.success(`Alarm set for ${formatTime12h(time24).formatted}`)
    setLabel('')
  }

  const handleDelete = (id) => {
    deleteAlarm(id)
    toast.success('Alarm deleted')
  }

  const handleToggle = (id) => {
    toggleAlarm(id)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink leading-tight">Alarms & Reminders</h2>
            <p className="text-xs text-muted">Flip clock alerts & calendar sync</p>
          </div>
        </div>
      }
      className="max-w-xl"
    >
      <div className="max-h-[78vh] overflow-y-auto space-y-6 px-6 py-4">
        {/* Top: Quick Presets */}
        <section>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
            Quick Time Offset
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '+5m', mins: 5 },
              { label: '+15m', mins: 15 },
              { label: '+30m', mins: 30 },
              { label: '+45m', mins: 45 },
              { label: '+1h', mins: 60 },
            ].map(({ label: btnLabel, mins }) => (
              <button
                key={btnLabel}
                type="button"
                onClick={() => handleAddMinutes(mins)}
                className="rounded-xl border border-line/70 bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-muted transition-all hover:border-accent hover:bg-accent/10 hover:text-accent active:scale-95 cursor-pointer"
              >
                {btnLabel}
              </button>
            ))}
            <button
              type="button"
              onClick={handleNextTopHour}
              className="rounded-xl border border-line/70 bg-surface-2/60 px-3 py-1.5 text-xs font-semibold text-muted transition-all hover:border-accent hover:bg-accent/10 hover:text-accent active:scale-95 cursor-pointer"
            >
              Next :00
            </button>
          </div>
        </section>

        {/* Time Selector & AM/PM */}
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="rounded-2xl border border-line/70 bg-surface-2/30 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Hour & Minute Digits */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                    Hour
                  </label>
                  <select
                    value={hour12}
                    onChange={(e) => setHour12(e.target.value)}
                    className="h-14 w-16 rounded-xl border border-line/80 bg-surface text-center font-mono text-2xl font-bold text-ink shadow-inner outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(
                      (h) => (
                        <option key={h} value={h} className="bg-surface text-ink">
                          {h}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <span className="mt-5 text-2xl font-bold text-muted select-none">:</span>

                <div className="flex flex-col items-center">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                    Minute
                  </label>
                  <select
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    className="h-14 w-16 rounded-xl border border-line/80 bg-surface text-center font-mono text-2xl font-bold text-ink shadow-inner outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
                  >
                    {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                      <option key={m} value={m} className="bg-surface text-ink">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AM / PM Toggle */}
                <div className="flex flex-col items-center ml-2">
                  <label className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                    Period
                  </label>
                  <div className="flex flex-col overflow-hidden rounded-xl border border-line/80 bg-surface">
                    <button
                      type="button"
                      onClick={() => setPeriod('AM')}
                      className={cn(
                        'px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer',
                        period === 'AM'
                          ? 'bg-accent text-white shadow-sm'
                          : 'text-muted hover:text-ink',
                      )}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriod('PM')}
                      className={cn(
                        'px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer',
                        period === 'PM'
                          ? 'bg-accent text-white shadow-sm'
                          : 'text-muted hover:text-ink',
                      )}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>

              {/* Repeat options */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Repeat
                </label>
                <div className="flex rounded-xl border border-line/80 bg-surface p-1">
                  {[
                    { id: 'once', label: 'Once' },
                    { id: 'daily', label: 'Daily' },
                    { id: 'weekdays', label: 'Weekdays' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRepeat(opt.id)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer',
                        repeat === opt.id
                          ? 'bg-surface-2 text-ink shadow-sm'
                          : 'text-muted hover:text-ink',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Label Input with quick chips */}
            <div className="mt-4 space-y-2">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="What is this reminder for? (e.g. Deep Focus, Drink Water)"
                className="w-full rounded-xl border border-line/80 bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
              />

              <div className="flex flex-wrap gap-1.5">
                {PRESET_LABELS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setLabel(p)}
                    className="rounded-lg border border-line/50 bg-surface/50 px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-accent/60 hover:text-ink cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound & Calendar Toggles */}
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-line/40 pt-3">
              {/* Sound picker */}
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted" />
                <select
                  value={sound}
                  onChange={(e) => setSound(e.target.value)}
                  className="rounded-lg border border-line/80 bg-surface px-2.5 py-1 text-xs font-medium text-ink outline-none transition-all focus:border-accent"
                >
                  {ALARM_SOUND_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-surface text-ink">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handlePreviewSound(sound)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-line/70 bg-surface text-muted transition-all hover:border-accent hover:text-accent cursor-pointer"
                  title="Test sound"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Calendar Visibility Checkbox */}
              <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibleOnCalendar}
                  onChange={(e) => setVisibleOnCalendar(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
                <Calendar className="h-3.5 w-3.5 text-accent" />
                <span>Show in Calendar & Agenda</span>
              </label>
            </div>

            {/* Submit Button */}
            <div className="mt-4">
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-accent/90 active:scale-[0.99] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Save Alarm</span>
              </button>
            </div>
          </div>
        </form>

        {/* Active Alarms List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              Scheduled Alarms ({alarms.length})
            </h3>
          </div>

          {alarms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/70 py-8 text-center text-xs text-muted">
              No alarms set yet. Pick a time above to schedule.
            </div>
          ) : (
            <div className="space-y-2">
              {alarms.map((a) => {
                const { formatted } = formatTime12h(a.time)
                const remaining = timeRemainingLabel(a.time)

                return (
                  <div
                    key={a.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border p-3 transition-all',
                      a.enabled
                        ? 'border-line/70 bg-surface shadow-sm'
                        : 'border-line/30 bg-surface-2/30 opacity-60',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(a.id)}
                        className={cn(
                          'flex h-6 w-11 shrink-0 rounded-full border transition-colors cursor-pointer relative',
                          a.enabled ? 'bg-accent border-accent' : 'bg-surface-2 border-line',
                        )}
                        title={a.enabled ? 'Turn off alarm' : 'Turn on alarm'}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all shadow-sm',
                            a.enabled ? 'left-5' : 'left-1',
                          )}
                        />
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-bold text-ink">
                            {formatted}
                          </span>
                          {a.enabled && (
                            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              {remaining}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted">
                          <span className="font-medium">{a.label || 'Alarm'}</span>
                          <span>•</span>
                          <span className="capitalize">{a.repeat}</span>
                          {a.visibleOnCalendar && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-0.5 text-accent">
                                <Calendar className="h-3 w-3" />
                                <span>Calendar</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePreviewSound(a.sound || 'alarm')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-surface-2 cursor-pointer transition-colors"
                        title="Preview sound"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                        title="Delete alarm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
