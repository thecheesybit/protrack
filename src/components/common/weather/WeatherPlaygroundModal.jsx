import { useState, useEffect } from 'react'
import {
  CloudRain,
  Wind,
  CloudFog,
  Sun,
  Flame,
  Shuffle,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { SettingsToggleRow } from '@/components/settings/SettingsUI'
import {
  INDIAN_SEASONS,
  getSeasonOverride,
  setSeasonOverride,
  getWeatherOverride,
  setWeatherOverride,
  isWeatherEffectsEnabled,
  setWeatherEffectsEnabled,
  computeWeatherState,
  getCurrentSeason,
  CLIMATE_OVERRIDE_EVENT,
} from '@/lib/indianClimate'
import { cn } from '@/utils/cn'

const PRESETS = [
  {
    id: 'monsoon_deluge',
    name: 'Varsha Midnight Deluge',
    season: 'varsha',
    weather: 'monsoon_rain',
    icon: CloudRain,
    desc: 'Dense rainfall streaks, lightning sheet flashes, and humid monsoon squalls.',
    color: 'from-sky-500/20 to-blue-600/20 text-sky-400 border-sky-500/30',
  },
  {
    id: 'summer_loo',
    name: 'May Midday Loo & Mirage',
    season: 'grishma',
    weather: 'summer_loo',
    icon: Flame,
    desc: 'Hot gusty "Loo" winds, swirling dust motes, dry leaves, and heat haze shimmer.',
    color: 'from-orange-500/20 to-amber-600/20 text-orange-400 border-orange-500/30',
  },
  {
    id: 'winter_kohra',
    name: 'December Delhi Kohra',
    season: 'shishir',
    weather: 'winter_fog',
    icon: CloudFog,
    desc: 'Thick morning fog blanket (Kohra) drifting over cold low sun and gentle breeze.',
    color: 'from-cyan-500/20 to-slate-600/20 text-cyan-400 border-cyan-500/30',
  },
  {
    id: 'spring_blossoms',
    name: 'Vasant Floral Breeze',
    season: 'vasant',
    weather: 'spring_breeze',
    icon: Wind,
    desc: 'Golden sun, floating flower petals, pollen dust, and playful balmy winds.',
    color: 'from-emerald-500/20 to-teal-600/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'autumn_kaash',
    name: 'Sharad Azure Clouds',
    season: 'sharad',
    weather: 'clear_sky',
    icon: Sun,
    desc: 'Deep washed azure skies, white cumulus cotton clouds, and mellow golden light.',
    color: 'from-amber-500/20 to-yellow-600/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'cyclonic_storm',
    name: 'Squall & Thunderstorm',
    season: 'varsha',
    weather: 'monsoon_rain',
    icon: Zap,
    desc: 'Severe wind squalls, heavy angled precipitation, and dramatic lightning.',
    color: 'from-purple-500/20 to-indigo-600/20 text-purple-400 border-purple-500/30',
  },
]

export function WeatherPlaygroundModal({ open, onClose }) {
  const [activeSeasonId, setActiveSeasonId] = useState(() => getSeasonOverride() || 'auto')
  const [activeWeather, setActiveWeather] = useState(() => getWeatherOverride())
  const [effectsEnabled, setEffectsEnabled] = useState(() => isWeatherEffectsEnabled())
  const [currentAtmosphere, setCurrentAtmosphere] = useState(() => computeWeatherState())

  useEffect(() => {
    if (!open) return
    setActiveSeasonId(getSeasonOverride() || 'auto')
    setActiveWeather(getWeatherOverride())
    setEffectsEnabled(isWeatherEffectsEnabled())
    setCurrentAtmosphere(computeWeatherState())

    const handleOverride = () => {
      setActiveSeasonId(getSeasonOverride() || 'auto')
      setActiveWeather(getWeatherOverride())
      setCurrentAtmosphere(computeWeatherState())
    }

    window.addEventListener(CLIMATE_OVERRIDE_EVENT, handleOverride)
    return () => window.removeEventListener(CLIMATE_OVERRIDE_EVENT, handleOverride)
  }, [open])

  const handleSelectSeason = (seasonId) => {
    setActiveSeasonId(seasonId)
    setSeasonOverride(seasonId === 'auto' ? null : seasonId)
    setCurrentAtmosphere(computeWeatherState())
  }

  const handleSelectWeather = (weatherType) => {
    setActiveWeather(weatherType)
    setWeatherOverride(weatherType)
    setCurrentAtmosphere(computeWeatherState())
  }

  const handleApplyPreset = (preset) => {
    setActiveSeasonId(preset.season)
    setSeasonOverride(preset.season)
    setActiveWeather(preset.weather)
    setWeatherOverride(preset.weather)
    setCurrentAtmosphere(computeWeatherState())
    toast.success(`Atmosphere set to ${preset.name}!`)
  }

  const handleRandomize = () => {
    const seasonOptions = ['shishir', 'vasant', 'grishma', 'varsha', 'sharad', 'hemant']
    const weatherOptions = ['monsoon_rain', 'summer_loo', 'winter_fog', 'spring_breeze', 'clear_sky']

    const randomSeason = seasonOptions[Math.floor(Math.random() * seasonOptions.length)]
    const randomWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)]

    setActiveSeasonId(randomSeason)
    setSeasonOverride(randomSeason)
    setActiveWeather(randomWeather)
    setWeatherOverride(randomWeather)
    setCurrentAtmosphere(computeWeatherState())

    const seasonObj = INDIAN_SEASONS.find((s) => s.id === randomSeason)
    toast.success(`Rolled: ${seasonObj?.name} (${seasonObj?.hindiName}) + ${randomWeather.replace('_', ' ')}!`, {
      icon: '🎲',
    })
  }

  const handleResetToAuto = () => {
    setActiveSeasonId('auto')
    setSeasonOverride(null)
    setActiveWeather(null)
    setWeatherOverride(null)
    setCurrentAtmosphere(computeWeatherState())
    toast.success('Restored natural Indian climate simulation.')
  }

  const handleToggleEffects = (enabled) => {
    setEffectsEnabled(enabled)
    setWeatherEffectsEnabled(enabled)
  }

  if (!open) return null

  const naturalSeason = getCurrentSeason()
  const displaySeason = activeSeasonId === 'auto' ? naturalSeason : INDIAN_SEASONS.find((s) => s.id === activeSeasonId)

  return (
    <Modal open={open} onClose={onClose} title="Atmospheric & Weather Sandbox" className="max-w-2xl">
      <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto pr-4">
        {/* Top Action Bar: Randomizer & Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-accent/20 bg-accent/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display text-sm font-bold text-ink">Random Weather Synthesizer</h4>
              <p className="text-xs text-muted">Generate unexpected combinations of season, precipitation, and winds.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRandomize}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-hover px-4 py-2 text-xs font-semibold text-white shadow-glow-xs hover:opacity-95 transition-all active:scale-95 cursor-pointer"
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span>Surprise Me</span>
            </button>
            <button
              type="button"
              onClick={handleResetToAuto}
              title="Reset to real-world calendar climate"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-line/70 bg-surface-2/60 text-muted hover:text-ink transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Atmosphere Status Badge */}
        <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted">
              Live Atmosphere Status
            </span>
            <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold text-accent">
              {activeSeasonId === 'auto' ? 'Natural Calendar Sync' : 'Sandbox Override Active'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-line/40 bg-surface/50 p-2.5">
              <span className="text-[calc(0.625rem*var(--text-scale,1))] font-medium text-muted block">Active Ritu</span>
              <span className="font-display text-xs font-bold text-ink truncate block mt-0.5">
                {displaySeason?.sanskritName} ({displaySeason?.hindiName})
              </span>
            </div>
            <div className="rounded-xl border border-line/40 bg-surface/50 p-2.5">
              <span className="text-[calc(0.625rem*var(--text-scale,1))] font-medium text-muted block">Weather Condition</span>
              <span className="font-display text-xs font-bold text-ink capitalize truncate block mt-0.5">
                {currentAtmosphere?.condition?.replace('_', ' ') || 'Clear Sky'}
              </span>
            </div>
            <div className="rounded-xl border border-line/40 bg-surface/50 p-2.5">
              <span className="text-[calc(0.625rem*var(--text-scale,1))] font-medium text-muted block">Simulated Wind</span>
              <span className="font-mono text-xs font-bold text-ink truncate block mt-0.5">
                {currentAtmosphere?.wind?.speed || 15} km/h · {currentAtmosphere?.wind?.direction || 'SW'}
              </span>
            </div>
            <div className="rounded-xl border border-line/40 bg-surface/50 p-2.5">
              <span className="text-[calc(0.625rem*var(--text-scale,1))] font-medium text-muted block">Atmospheric Layers</span>
              <span className="font-mono text-xs font-bold text-ink truncate block mt-0.5">
                {currentAtmosphere?.rain ? 'Rain' : currentAtmosphere?.fog ? 'Fog' : currentAtmosphere?.haze ? 'Haze' : 'Crisp'}
              </span>
            </div>
          </div>
        </div>

        {/* Weather Effects Toggle */}
        <SettingsToggleRow
          icon={Wind}
          title="Atmospheric Effects"
          description="Rain streaks, fog, wind particles, and heat haze rendered over the dashboard. Turn off for a calmer, static background."
          checked={effectsEnabled}
          onChange={handleToggleEffects}
          badge={effectsEnabled ? 'Enabled' : 'Off'}
        />

        {/* Atmosphere Presets Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted">
              Atmosphere Presets
            </span>
            <span className="text-[calc(0.6875rem*var(--text-scale,1))] text-muted">Click to instantly load</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESETS.map((p) => {
              const Icon = p.icon
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border bg-gradient-to-br p-3.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer',
                    p.color
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/20 backdrop-blur-sm mt-0.5">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xs font-bold text-ink">{p.name}</p>
                    <p className="text-[calc(0.6875rem*var(--text-scale,1))] text-muted/90 mt-0.5 leading-relaxed line-clamp-2">{p.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Manual Fine-Grained Controls */}
        <div className="space-y-4 pt-2 border-t border-line/40">
          <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted block">
            Manual Season & Weather Overrides
          </span>

          {/* Season Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink block">Select Indian Season (Shad Ritu):</label>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectSeason('auto')}
                className={cn(
                  'rounded-xl border px-2 py-1.5 text-[calc(0.6875rem*var(--text-scale,1))] font-semibold transition-all cursor-pointer text-center',
                  activeSeasonId === 'auto'
                    ? 'border-accent bg-accent/20 text-accent font-bold shadow-xs'
                    : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink'
                )}
              >
                Auto (Sync)
              </button>
              {INDIAN_SEASONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSeason(s.id)}
                  className={cn(
                    'rounded-xl border px-2 py-1.5 text-[calc(0.6875rem*var(--text-scale,1))] font-semibold transition-all cursor-pointer text-center',
                    activeSeasonId === s.id
                      ? 'border-accent bg-accent/20 text-accent font-bold shadow-xs'
                      : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink'
                  )}
                >
                  {s.sanskritName}
                </button>
              ))}
            </div>
          </div>

          {/* Weather Condition Overrides */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink block">Force Weather Condition:</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'monsoon_rain', label: 'Rain & Storm', icon: CloudRain },
                { id: 'summer_loo', label: 'Loo & Wind', icon: Wind },
                { id: 'winter_fog', label: 'Winter Fog', icon: CloudFog },
                { id: 'spring_breeze', label: 'Spring Petals', icon: Sun },
                { id: 'clear_sky', label: 'Clear Skies', icon: Sparkles },
              ].map((w) => {
                const Icon = w.icon
                const isSelected = activeWeather === w.id
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleSelectWeather(isSelected ? null : w.id)}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-all cursor-pointer',
                      isSelected
                        ? 'border-accent bg-accent/15 text-accent shadow-xs'
                        : 'border-line/60 bg-surface-2/30 text-muted hover:text-ink'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[calc(0.6875rem*var(--text-scale,1))] font-semibold">{w.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer info & Done */}
        <div className="flex items-center justify-between pt-4 border-t border-line/40">
          <button
            type="button"
            onClick={handleResetToAuto}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset to Natural Calendar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-accent px-5 py-2 text-xs font-semibold text-white shadow-glow-xs hover:bg-accent-hover transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
