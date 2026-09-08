import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  AudioLines,
  TreePine,
  CloudRain,
  Waves,
  Wind,
  Coffee,
  Trees,
  Headphones,
  VolumeX,
  Volume2,
  Plus,
  X,
} from 'lucide-react'
import { VIDEO_PRESETS, youtubeId } from '@/lib/focusScenes'
import { cn } from '@/utils/cn'

const PRESETS = [10, 15, 25, 30, 45, 50, 60, 90]

const AMBIENTS = [
  { id: 'none', label: 'Off', Icon: VolumeX },
  { id: 'rain', label: 'Rain', Icon: CloudRain },
  { id: 'waves', label: 'Waves', Icon: Waves },
  { id: 'wind', label: 'Wind', Icon: Wind },
  { id: 'whitenoise', label: 'White Noise', Icon: AudioLines },
  { id: 'cafe', label: 'Cafe', Icon: Coffee },
  { id: 'forest', label: 'Forest', Icon: Trees },
  { id: 'binaural', label: 'Binaural', Icon: Headphones },
]

/**
 * The Time / Audio / Scene customization surface — shared verbatim by the Deep
 * Focus widget's hero and compact variants so both offer the same controls.
 */
export function FocusSetup({
  activeTab,
  setActiveTab,
  isIdle,
  workMin,
  breakMin,
  setWork,
  setBreak,
  setCustomTimer,
  timerPresets = [],
  saveTimerPreset,
  removeTimerPreset,
  audioTracks,
  toggleConcurrentTrack,
  volume,
  setVolume,
  muted,
  toggleMute,
  focusAudioUrl,
  updateFocusAudioUrl,
  loadStream,
  selectVideoPreset,
  customPresets = [],
  maxWidth = 300,
}) {
  const panelStyle = { maxWidth }

  return (
    <div className="flex w-full flex-col items-center gap-2.5" style={panelStyle}>
      {/* Tab switcher */}
      <div className="flex w-full rounded-2xl border border-white/10 bg-black/40 p-1 backdrop-blur-md">
        {[
          { id: 'timer', label: 'Time', Icon: Clock },
          { id: 'sounds', label: 'Audio', Icon: AudioLines },
          { id: 'scenes', label: 'Scene', Icon: TreePine },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold uppercase tracking-wider transition-all',
              activeTab === id
                ? 'border border-white/10 bg-white/10 text-white shadow-glow-sm'
                : 'border border-transparent text-white/50 hover:text-white',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      <div className="flex min-h-[110px] w-full justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex w-full justify-center"
          >
            {activeTab === 'timer' && (
              <div className="flex w-full flex-col items-center gap-2.5">
                <div className="grid w-full grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1 backdrop-blur-sm">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      disabled={!isIdle}
                      onClick={() => setWork(p)}
                      className={cn(
                        'rounded-xl py-1.5 text-[11px] font-semibold transition-all disabled:opacity-50',
                        workMin === p
                          ? 'bg-accent text-white shadow-glow-sm'
                          : 'text-white/70 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {p}m
                    </button>
                  ))}
                </div>

                <div className="flex w-full gap-2">
                  {[
                    { label: 'Focus', val: workMin, set: setWork, step: 5, max: 240, min: 1 },
                    { label: 'Break', val: breakMin, set: setBreak, step: 1, max: 60, min: 0 },
                  ].map(({ label, val, set, step, max, min }) => (
                    <div
                      key={label}
                      className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-black/30 px-2 py-2"
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                        {label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!isIdle}
                          onClick={() => set(val - step)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-white/70 hover:text-white disabled:opacity-40"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={min}
                          max={max}
                          value={val}
                          onChange={(e) => set(Number(e.target.value))}
                          disabled={!isIdle}
                          className="w-10 rounded-lg border border-white/20 bg-black/60 px-1 py-1 text-center text-sm font-semibold text-white outline-none focus:border-accent disabled:opacity-40"
                        />
                        <button
                          type="button"
                          disabled={!isIdle}
                          onClick={() => set(val + step)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/15 bg-black/50 text-white/70 hover:text-white disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex w-full flex-wrap items-center gap-1">
                  {timerPresets.map((p, idx) => (
                    <span
                      key={`${p.work}-${p.break}-${idx}`}
                      className={cn(
                        'group flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors',
                        p.work === workMin && p.break === breakMin
                          ? 'border-accent/50 bg-accent/15 text-accent'
                          : 'border-white/15 bg-black/40 text-white/70 hover:text-white',
                      )}
                    >
                      <button
                        type="button"
                        disabled={!isIdle}
                        onClick={() => setCustomTimer(p.work * 60, p.break * 60)}
                        className="disabled:opacity-40"
                      >
                        {p.work}/{p.break}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTimerPreset(idx)}
                        className="opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                        aria-label="Remove preset"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={saveTimerPreset}
                    className="flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2 py-1 text-[10px] font-medium text-white/50 transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    <Plus className="h-2.5 w-2.5" /> Save {workMin}/{breakMin}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'sounds' && (
              <div className="flex w-full flex-col gap-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {AMBIENTS.map(({ id, label, Icon }) => {
                    const isActive = audioTracks.ambient1 === id || audioTracks.ambient2 === id
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          if (isActive) {
                            if (audioTracks.ambient1 === id) toggleConcurrentTrack('ambient1', 'off')
                            else toggleConcurrentTrack('ambient2', 'off')
                          } else if (!audioTracks.ambient1 || audioTracks.ambient1 === 'off') {
                            toggleConcurrentTrack('ambient1', id)
                          } else {
                            toggleConcurrentTrack('ambient2', id)
                          }
                        }}
                        title={label}
                        className={cn(
                          'group flex h-10 items-center justify-center rounded-xl border transition-all',
                          isActive
                            ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm ring-1 ring-accent/30'
                            : 'border-white/20 bg-black/60 text-white/70 hover:border-white/40 hover:bg-black/80 hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-1.5">
                  <button
                    onClick={toggleMute}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white/70 transition-colors hover:bg-black/80 hover:text-white/90',
                      muted && 'border-red-500/30 text-red-400',
                    )}
                    title={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(volume * 100)}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-black/60 accent-accent [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-glow-sm"
                  />
                  <span className="w-8 text-right text-[10px] font-medium tabular-nums text-white/60">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'scenes' && (
              <div className="flex w-full flex-col gap-2.5">
                <div className="grid grid-cols-3 gap-1">
                  {[...VIDEO_PRESETS, ...customPresets].map((p, idx) => {
                    const isSelected =
                      focusAudioUrl === p.url ||
                      (Boolean(focusAudioUrl) && youtubeId(focusAudioUrl) === youtubeId(p.url))
                    return (
                      <button
                        key={p.url + idx}
                        onClick={() => selectVideoPreset(p.url)}
                        className={cn(
                          'truncate rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                          isSelected
                            ? 'border-accent/50 bg-accent/15 text-accent'
                            : 'border-white/20 bg-black/60 text-white/70 hover:border-accent/50 hover:bg-black/80 hover:text-white',
                        )}
                        title={p.label}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => updateFocusAudioUrl('')}
                    className={cn(
                      'truncate rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                      !focusAudioUrl
                        ? 'border-accent/50 bg-accent/15 text-accent'
                        : 'border-white/20 bg-black/60 text-white/70 hover:border-accent/50 hover:bg-black/80 hover:text-white',
                    )}
                  >
                    Off
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={focusAudioUrl}
                    onChange={(e) => updateFocusAudioUrl(e.target.value)}
                    placeholder="Custom YouTube URL..."
                    className="w-full flex-1 rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-xs text-white outline-none backdrop-blur-sm placeholder:text-white/40 focus:border-accent"
                  />
                  <button
                    onClick={loadStream}
                    className="shrink-0 rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-black/80 hover:text-white"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
