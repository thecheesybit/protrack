import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Bell,
  BellRing,
  Clock,
  Calendar,
  Volume2,
  VolumeX,
  Trash2,
  Plus,
  Play,
  Square,
  ChevronUp,
  ChevronDown,
  Check,
  RotateCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
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
import { playSound, stopAlarmRingtone, soundsEnabled, setSoundsEnabled } from '@/lib/sound'
import { playPop, playSuccess } from '@/lib/audioFX'
import { cn } from '@/utils/cn'

export function AlarmModal({ open, onClose }) {
  const [alarms, setAlarms] = useState(() => getAlarms())
  const [activeTab, setActiveTab] = useState('create') // 'create' | 'list'

  // Time & Form State
  const [hour12, setHour12] = useState('08')
  const [minute, setMinute] = useState('00')
  const [period, setPeriod] = useState('AM')
  const [label, setLabel] = useState('')
  const [repeat, setRepeat] = useState('once') // 'once' | 'daily' | 'weekdays'
  const [sound, setSound] = useState('alarm')
  const [visibleOnCalendar, setVisibleOnCalendar] = useState(true)

  // Audio Testing State
  const [previewingSound, setPreviewingSound] = useState(null)
  const [isAudioMuted, setIsAudioMuted] = useState(() => !soundsEnabled())
  const previewTimerRef = useRef(null)

  // Sync alarms when storage changes
  useEffect(() => {
    if (!open) return
    const sync = () => setAlarms(getAlarms())
    window.addEventListener(ALARMS_CHANGED_EVENT, sync)
    sync()
    return () => window.removeEventListener(ALARMS_CHANGED_EVENT, sync)
  }, [open])

  // Cleanup any playing audio on close or unmount
  useEffect(() => {
    if (!open) {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      stopAlarmRingtone()
      setPreviewingSound(null)
    }
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
      setIsAudioMuted(!soundsEnabled())
    }
  }, [open])

  // Stepper handlers for tactile time picker
  const incrementHour = () => {
    try { playPop() } catch { /* noop */ }
    setHour12((prev) => {
      let n = parseInt(prev, 10) + 1
      if (n > 12) n = 1
      return String(n).padStart(2, '0')
    })
  }

  const decrementHour = () => {
    try { playPop() } catch { /* noop */ }
    setHour12((prev) => {
      let n = parseInt(prev, 10) - 1
      if (n < 1) n = 12
      return String(n).padStart(2, '0')
    })
  }

  const incrementMinute = () => {
    try { playPop() } catch { /* noop */ }
    setMinute((prev) => {
      let n = (parseInt(prev, 10) + 5) % 60
      return String(n).padStart(2, '0')
    })
  }

  const decrementMinute = () => {
    try { playPop() } catch { /* noop */ }
    setMinute((prev) => {
      let n = (parseInt(prev, 10) - 5 + 60) % 60
      return String(n).padStart(2, '0')
    })
  }

  // Quick preset offset handlers
  const handleAddMinutes = (mins) => {
    try { playPop() } catch { /* noop */ }
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
    try { playPop() } catch { /* noop */ }
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

  // Interactive Audio Testing
  const handleTestAudio = (soundId) => {
    if (previewingSound === soundId) {
      stopAlarmRingtone()
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
      setPreviewingSound(null)
      return
    }

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    setPreviewingSound(soundId)

    // Ensure audio is enabled so the user can definitely hear it
    if (!soundsEnabled()) {
      setSoundsEnabled(true)
      setIsAudioMuted(false)
      toast.success('App sound unmuted for audio test', { icon: '🔊' })
    }

    playSound(soundId)

    const duration = soundId === 'alarm' ? 2600 : soundId === 'temple' ? 3400 : 2000
    previewTimerRef.current = setTimeout(() => {
      setPreviewingSound(null)
    }, duration)
  }

  const handleUnmuteApp = () => {
    setSoundsEnabled(true)
    setIsAudioMuted(false)
    toast.success('Sound enabled in app settings', { icon: '🔊' })
    playSound('pop')
  }

  const handleCreate = (e) => {
    e.preventDefault()
    const time24 = to24hTime(hour12, minute, period)
    createAlarm({
      time: time24,
      label: label.trim() || 'Alarm Reminder',
      enabled: true,
      repeat,
      sound,
      visibleOnCalendar,
    })

    try { playSuccess() } catch { /* noop */ }
    const formatted = `${hour12}:${minute} ${period}`
    toast.success(`Alarm set for ${formatted}`)
    setLabel('')
    setActiveTab('list')
  }

  const handleDelete = (id) => {
    deleteAlarm(id)
    toast.success('Alarm deleted')
  }

  const handleToggle = (id) => {
    toggleAlarm(id)
  }

  const currentTimeFormatted = useMemo(() => {
    return `${hour12}:${minute} ${period}`
  }, [hour12, minute, period])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/25 shadow-sm">
            <BellRing className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-ink tracking-tight leading-tight">
              Alarms & Reminders
            </h2>
            <p className="text-xs text-muted">
              Tactile flip alerts, ringtones & calendar sync
            </p>
          </div>
        </div>
      }
      className="max-w-xl"
    >
      <div className="max-h-[82vh] overflow-y-auto">
        {/* Top Tab Bar: New Alarm vs Saved Alarms */}
        <div className="flex items-center justify-between border-b border-line/60 px-6 pt-3 bg-surface-2/20 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('create')
                try { playPop() } catch { /* noop */ }
              }}
              className={cn(
                'flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer select-none',
                activeTab === 'create'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Set Alarm</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('list')
                try { playPop() } catch { /* noop */ }
              }}
              className={cn(
                'flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer select-none',
                activeTab === 'list'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Saved Alarms</span>
              {alarms.length > 0 && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none',
                    activeTab === 'list'
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-muted border border-line/40',
                  )}
                >
                  {alarms.length}
                </span>
              )}
            </button>
          </div>

          <span className="text-[11px] font-semibold text-muted/80 pb-2.5 hidden sm:inline-block">
            Alt + A Shortcut
          </span>
        </div>

        {/* Tab 1: Create New Alarm */}
        {activeTab === 'create' && (
          <div className="space-y-5 px-6 py-4">
            {/* Quick Offset Presets */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Quick Time Presets
                </label>
                <span className="text-[10px] text-muted/70">Click to shift time</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
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
                    className="rounded-xl border border-line/70 bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-all hover:border-accent hover:bg-accent/10 hover:text-accent active:scale-95 cursor-pointer select-none"
                  >
                    {btnLabel}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleNextTopHour}
                  className="rounded-xl border border-line/70 bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-all hover:border-accent hover:bg-accent/10 hover:text-accent active:scale-95 cursor-pointer select-none"
                >
                  Next :00
                </button>
              </div>
            </section>

            {/* Tactile Time Display & Steppers */}
            <section className="rounded-2xl border border-line/80 bg-surface-2/30 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center justify-around gap-4">
                {/* Digital Stepper Display */}
                <div className="flex items-center gap-3">
                  {/* Hour Column */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={incrementHour}
                      className="flex h-7 w-12 items-center justify-center rounded-lg border border-line/60 bg-surface text-muted hover:text-accent hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
                      title="Increment Hour"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-line/80 bg-surface shadow-inner">
                      <span className="font-mono text-3xl font-black text-ink select-none tabular-nums tracking-tight">
                        {hour12}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted/70">
                        Hour
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={decrementHour}
                      className="flex h-7 w-12 items-center justify-center rounded-lg border border-line/60 bg-surface text-muted hover:text-accent hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
                      title="Decrement Hour"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Pulsing Colon */}
                  <div className="flex flex-col items-center justify-center h-16">
                    <span className="font-mono text-2xl font-black text-accent select-none animate-pulse">
                      :
                    </span>
                  </div>

                  {/* Minute Column */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={incrementMinute}
                      className="flex h-7 w-12 items-center justify-center rounded-lg border border-line/60 bg-surface text-muted hover:text-accent hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
                      title="Increment Minute (+5m)"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <div className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-line/80 bg-surface shadow-inner">
                      <span className="font-mono text-3xl font-black text-ink select-none tabular-nums tracking-tight">
                        {minute}
                      </span>
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted/70">
                        Min
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={decrementMinute}
                      className="flex h-7 w-12 items-center justify-center rounded-lg border border-line/60 bg-surface text-muted hover:text-accent hover:border-accent/40 active:scale-95 transition-all cursor-pointer"
                      title="Decrement Minute (-5m)"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* AM / PM Toggle */}
                  <div className="flex flex-col gap-1.5 ml-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPeriod('AM')
                        try { playPop() } catch { /* noop */ }
                      }}
                      className={cn(
                        'h-8 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer select-none',
                        period === 'AM'
                          ? 'bg-accent border-accent text-white shadow-sm shadow-accent/25 scale-105'
                          : 'border-line/70 bg-surface text-muted hover:text-ink hover:border-line',
                      )}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPeriod('PM')
                        try { playPop() } catch { /* noop */ }
                      }}
                      className={cn(
                        'h-8 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer select-none',
                        period === 'PM'
                          ? 'bg-accent border-accent text-white shadow-sm shadow-accent/25 scale-105'
                          : 'border-line/70 bg-surface text-muted hover:text-ink hover:border-line',
                      )}
                    >
                      PM
                    </button>
                  </div>
                </div>

                {/* Repeat Cadence Selector */}
                <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Recurrence
                  </label>
                  <div className="flex rounded-xl border border-line/80 bg-surface p-1 shadow-sm">
                    {[
                      { id: 'once', label: 'Once', icon: Bell },
                      { id: 'daily', label: 'Daily', icon: RotateCw },
                      { id: 'weekdays', label: 'Weekdays', icon: Calendar },
                    ].map((opt) => {
                      const Icon = opt.icon
                      const isSelected = repeat === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setRepeat(opt.id)
                            try { playPop() } catch { /* noop */ }
                          }}
                          className={cn(
                            'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer select-none',
                            isSelected
                              ? 'bg-accent text-white shadow-sm'
                              : 'text-muted hover:text-ink',
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Label Input with Productivity Chips */}
            <section className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                Reminder Label & Purpose
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="What is this reminder for? (e.g. Deep Focus, Drink Water)"
                className="w-full rounded-xl border border-line/80 bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-muted/60 outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
              />

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {PRESET_LABELS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setLabel(p)
                      try { playPop() } catch { /* noop */ }
                    }}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer select-none',
                      label === p
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-line/60 bg-surface/60 text-muted hover:border-accent/60 hover:text-ink',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            {/* Audio Profile & Sound Test Station */}
            <section className="rounded-2xl border border-line/80 bg-surface-2/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <Volume2 className="h-3.5 w-3.5 text-accent" />
                  <span>Alarm Ringtone & Audio Profile</span>
                </label>
                {previewingSound && (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-accent">
                    <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                    Audio playing...
                  </span>
                )}
              </div>

              {/* Sound Profile Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALARM_SOUND_OPTIONS.map((opt) => {
                  const isSelected = sound === opt.id
                  const isThisPlaying = previewingSound === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSound(opt.id)
                        handleTestAudio(opt.id)
                      }}
                      className={cn(
                        'relative flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none',
                        isSelected
                          ? 'bg-accent/10 border-accent/60 shadow-sm ring-1 ring-accent/30 text-ink'
                          : 'bg-surface border-line/70 hover:border-accent/40 text-muted hover:text-ink',
                      )}
                    >
                      <div className="min-w-0 pr-1">
                        <p
                          className={cn(
                            'text-xs font-bold truncate',
                            isSelected ? 'text-accent' : 'text-ink',
                          )}
                        >
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-muted truncate">
                          {opt.id === 'alarm'
                            ? 'Vibrant melody'
                            : opt.id === 'temple'
                              ? 'Bronze bell'
                              : 'Harmonic tone'}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isThisPlaying ? (
                          <div className="flex items-end gap-0.5 h-3.5 px-0.5">
                            <span
                              className="w-0.5 bg-accent rounded-full animate-[sound-bar_0.4s_ease-in-out_infinite]"
                              style={{ height: '100%' }}
                            />
                            <span
                              className="w-0.5 bg-accent rounded-full animate-[sound-bar_0.6s_ease-in-out_infinite_0.1s]"
                              style={{ height: '65%' }}
                            />
                            <span
                              className="w-0.5 bg-accent rounded-full animate-[sound-bar_0.5s_ease-in-out_infinite_0.2s]"
                              style={{ height: '85%' }}
                            />
                          </div>
                        ) : isSelected ? (
                          <Check className="h-3.5 w-3.5 text-accent" />
                        ) : (
                          <Play className="h-3 w-3 text-muted/40" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Dedicated "Play & Test Audio" Control */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleTestAudio(sound)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-sm cursor-pointer select-none',
                    previewingSound === sound
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95'
                      : 'bg-surface text-ink border border-line/80 hover:border-accent hover:text-accent hover:bg-accent/5 active:scale-95',
                  )}
                >
                  {previewingSound === sound ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop Sound Test</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current text-accent" />
                      <span>
                        Play & Test "
                        {ALARM_SOUND_OPTIONS.find((o) => o.id === sound)?.label || 'Sound'}"
                      </span>
                    </>
                  )}
                </button>

                {!isAudioMuted ? (
                  <span className="text-[11px] text-emerald-500 flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Audio output active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleUnmuteApp}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1 underline cursor-pointer"
                    title="Click to enable sound in app settings"
                  >
                    <VolumeX className="h-3.5 w-3.5" />
                    Sounds muted in settings (Unmute)
                  </button>
                )}
              </div>
            </section>

            {/* Calendar Integration Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibleOnCalendar}
                  onChange={(e) => setVisibleOnCalendar(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent accent-accent"
                />
                <Calendar className="h-3.5 w-3.5 text-accent" />
                <span>Show in Calendar & Today's Agenda</span>
              </label>
            </div>

            {/* Save Alarm Action */}
            <button
              type="button"
              onClick={handleCreate}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-xs font-extrabold text-white shadow-md transition-all hover:bg-accent/90 active:scale-[0.99] cursor-pointer select-none"
            >
              <Plus className="h-4 w-4" />
              <span>Save Alarm for {currentTimeFormatted}</span>
            </button>
          </div>
        )}

        {/* Tab 2: Saved Alarms List */}
        {activeTab === 'list' && (
          <div className="space-y-4 px-6 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                Active & Scheduled Alarms ({alarms.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="flex items-center gap-1 rounded-lg bg-accent/10 border border-accent/30 px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent hover:text-white transition-all cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>New Alarm</span>
              </button>
            </div>

            {alarms.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line/70 py-10 text-center space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-2 text-muted mx-auto border border-line/50">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ink">No alarms configured</p>
                  <p className="text-[11px] text-muted">
                    Set your first flip-clock alarm or reminder to stay focused.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-accent/90 cursor-pointer"
                >
                  Create Alarm
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {alarms.map((a) => {
                  const { formatted } = formatTime12h(a.time)
                  const remaining = timeRemainingLabel(a.time)
                  const isThisPlaying = previewingSound === (a.sound || 'alarm')

                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all shadow-xs',
                        a.enabled
                          ? 'border-line/80 bg-surface hover:border-accent/40'
                          : 'border-line/40 bg-surface-2/30 opacity-60',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* On / Off Switch */}
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
                            <span className="font-mono text-base font-extrabold text-ink">
                              {formatted}
                            </span>
                            {a.enabled && (
                              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                                {remaining}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted">
                            <span className="font-semibold text-ink/80">{a.label || 'Alarm'}</span>
                            <span>•</span>
                            <span className="capitalize">{a.repeat}</span>
                            <span>•</span>
                            <span className="capitalize">{a.sound || 'alarm'}</span>
                            {a.visibleOnCalendar && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-accent font-medium">
                                  <Calendar className="h-3 w-3" />
                                  <span>Agenda</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Play / Test Sound on Saved Alarm Card */}
                        <button
                          type="button"
                          onClick={() => handleTestAudio(a.sound || 'alarm')}
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer',
                            isThisPlaying
                              ? 'border-accent bg-accent/15 text-accent animate-pulse'
                              : 'border-line/70 bg-surface text-muted hover:text-accent hover:border-accent/40',
                          )}
                          title="Test audio for this alarm"
                        >
                          {isThisPlaying ? (
                            <Square className="h-3.5 w-3.5 fill-current" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-line/60 bg-surface text-muted hover:text-rose-500 hover:border-rose-500/40 hover:bg-rose-500/10 cursor-pointer transition-colors"
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
          </div>
        )}
      </div>
    </Modal>
  )
}
