import { useState, useEffect } from 'react'
import {
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Clock,
  Sparkles,
  CloudRain,
  Wind,
  CloudFog,
  RotateCcw,
  Check,
  Flame,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLowPowerMode } from '@/lib/lowPower'
import toast from 'react-hot-toast'
import {
  TIMED_THEMES,
  CHRONO_SLOTS,
  getThemeCategory,
  readChronoOverride,
  setChronoOverride as setGlobalChronoOverride,
  CHRONO_OVERRIDE_EVENT,
} from '@/hooks/useChronoTheme'
import {
  INDIAN_SEASONS,
  getActiveIndianSeason,
  readSeasonOverride,
  setSeasonOverride,
  readWeatherOverride,
  setWeatherOverride,
  isWeatherEffectsEnabled,
  setWeatherEffectsEnabled,
  CLIMATE_OVERRIDE_EVENT,
} from '@/lib/indianClimate'
import { WeatherPlaygroundModal } from '@/components/common/weather/WeatherPlaygroundModal'
import { SettingsSection, SettingsCard, SettingsBadge, SettingsToggleRow } from '../SettingsUI'

export function AppearanceTab({
  theme,
  setTheme,
  toggleTheme: _toggleTheme,
  fontScale,
  setFontScale,
  fontFamily,
  setFontFamily,
}) {
  const [chronoOverride, setChronoOverrideState] = useState(() => readChronoOverride())
  const [lowPowerMode, toggleLowPowerMode] = useLowPowerMode()

  const [activeSeason, setActiveSeason] = useState(() => getActiveIndianSeason())
  const [seasonOverride, setSeasonOverrideState] = useState(() => readSeasonOverride())
  const [weatherOverride, setWeatherOverrideState] = useState(() => readWeatherOverride())
  const [weatherEffects, setWeatherEffectsState] = useState(() => isWeatherEffectsEnabled())
  const [playgroundOpen, setPlaygroundOpen] = useState(false)

  const handleSetChrono = (val) => {
    setGlobalChronoOverride(val)
    setChronoOverrideState(readChronoOverride())
  }

  const handleSelectSeason = (seasonId) => {
    setSeasonOverride(seasonId)
    setSeasonOverrideState(seasonId === 'auto' ? null : seasonId)
    setActiveSeason(getActiveIndianSeason())
    toast.success(
      seasonId === 'auto'
        ? 'Synced with local Indian calendar'
        : `Season set to ${INDIAN_SEASONS.find((s) => s.id === seasonId)?.name}`
    )
  }

  const handleTestWeather = (condition) => {
    setWeatherOverride(condition)
    setWeatherOverrideState(condition)
    toast.success(`Atmospheric effect: ${condition.replace('_', ' ')}`)
  }

  const handleResetWeather = () => {
    setWeatherOverride('auto')
    setWeatherOverrideState(null)
    toast.success('Weather returned to dynamic seasonal simulation')
  }

  const handleToggleWeatherEffects = (checked) => {
    setWeatherEffectsEnabled(checked)
    setWeatherEffectsState(checked)
    toast.success(checked ? 'Seasonal weather effects enabled' : 'Seasonal weather effects disabled')
  }

  useEffect(() => {
    const handleSync = () => {
      setChronoOverrideState(readChronoOverride())
      setActiveSeason(getActiveIndianSeason())
      setSeasonOverrideState(readSeasonOverride())
      setWeatherOverrideState(readWeatherOverride())
      setWeatherEffectsState(isWeatherEffectsEnabled())
    }

    window.addEventListener(CHRONO_OVERRIDE_EVENT, handleSync)
    window.addEventListener(CLIMATE_OVERRIDE_EVENT, handleSync)
    return () => {
      window.removeEventListener(CHRONO_OVERRIDE_EVENT, handleSync)
      window.removeEventListener(CLIMATE_OVERRIDE_EVENT, handleSync)
    }
  }, [])

  return (
    <div className="space-y-8 pb-4">
      {/* ── Theme Mode ─────────────────────────────────────────────── */}
      <SettingsSection
        title="Theme & Canvas Mode"
        description="Select your visual base: warm parchment canvas, cinematic obsidian dark, or auto-following the sun."
      >
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'light', label: 'Light (Parchment)', icon: Sun },
            { key: 'dark', label: 'Dark (Obsidian)', icon: Moon },
            { key: 'auto', label: 'Auto (Day/Night)', icon: Clock },
          ].map((opt) => {
            const IconComp = opt.icon
            const isSelected = theme === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTheme?.(opt.key)}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-xs font-semibold transition-all duration-200 cursor-pointer',
                  isSelected
                    ? 'border-accent bg-accent/15 text-accent shadow-glow-xs font-bold'
                    : 'border-line/70 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                    isSelected ? 'bg-accent text-white shadow-xs' : 'bg-surface text-muted'
                  )}
                >
                  <IconComp className="h-4.5 w-4.5" />
                </div>
                <span>{opt.label}</span>
              </button>
            )
          })}
        </div>
      </SettingsSection>

      {/* ── Indian Climate & Seasonal Ritu Engine ─────────────────────── */}
      <SettingsSection
        title="Indian Climate & Seasonal Ritu Engine"
        description="Authentic Indian 6-season meteorological cycle (Shad Ritu) with dynamic wind, occasional rain, and organic weather shifts."
      >
        {/* Active Season Banner */}
        <SettingsCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-accent/25 bg-accent/[0.04]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink">
                Active Season: {activeSeason.sanskritName} ({activeSeason.name}) · {activeSeason.hindiName}
              </span>
              <SettingsBadge variant="accent">
                {!seasonOverride ? 'Calendar Synced' : 'Locked'}
              </SettingsBadge>
            </div>
            <p className="text-xs text-muted leading-relaxed max-w-xl">
              {activeSeason.desc}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] uppercase tracking-wider text-muted bg-surface-2/60 border border-line/60 rounded-lg px-2.5 py-1">
              {activeSeason.monthsText}
            </span>
          </div>
        </SettingsCard>

        {/* 6 Seasons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Option: Auto Calendar Synced */}
          <button
            type="button"
            onClick={() => handleSelectSeason('auto')}
            className={cn(
              'flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none',
              !seasonOverride
                ? 'border-accent bg-accent/15 text-ink shadow-glow-xs ring-1 ring-accent/30 font-bold'
                : 'border-line/70 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60'
            )}
          >
            <div className="flex w-full items-center justify-between mb-1.5">
              <span className="text-xs font-bold">Auto (Calendar Synced)</span>
              {!seasonOverride && <Check className="h-4 w-4 text-accent stroke-[2.5]" />}
            </div>
            <span className="text-xs text-muted leading-tight">
              Automatically follows your current month & Indian weather patterns.
            </span>
          </button>

          {INDIAN_SEASONS.map((s) => {
            const isSelected = seasonOverride === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSeason(s.id)}
                className={cn(
                  'flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none',
                  isSelected
                    ? 'border-accent bg-accent/15 text-ink shadow-glow-xs ring-1 ring-accent/30 font-bold'
                    : 'border-line/70 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60'
                )}
              >
                <div className="flex w-full items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold truncate">
                      {s.sanskritName} ({s.name})
                    </span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-accent stroke-[2.5] shrink-0" />}
                </div>
                <span className="font-mono text-[calc(0.625rem*var(--text-scale,1))] uppercase tracking-wider text-accent font-semibold mb-1">
                  {s.monthsText} · {s.hindiName}
                </span>
                <span className="text-xs text-muted/80 leading-tight line-clamp-2">
                  {s.desc}
                </span>
              </button>
            )
          })}
        </div>

        {/* Dynamic Weather Simulation & Test Overlays */}
        <SettingsCard className="p-5 space-y-3.5 mt-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-ink">Interactive Weather Simulation</span>
              <p className="text-xs text-muted mt-0.5">
                Preview real climatic conditions on demand, or let the simulation run naturally.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaygroundOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-all cursor-pointer shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Weather Playground</span>
              </button>
              {weatherOverride && (
                <button
                  type="button"
                  onClick={handleResetWeather}
                  className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" /> Reset to Auto
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => handleTestWeather('rain')}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer',
                weatherOverride === 'rain' || weatherOverride === 'monsoon_rain' || weatherOverride === 'cyclonic_storm'
                  ? 'border-accent bg-accent/15 text-accent shadow-xs font-bold'
                  : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
              )}
            >
              <CloudRain className="h-4 w-4 text-sky-400" />
              <span>Monsoon Rain</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestWeather('breezy')}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer',
                weatherOverride === 'breezy' || weatherOverride === 'spring_breeze'
                  ? 'border-accent bg-accent/15 text-accent shadow-xs font-bold'
                  : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
              )}
            >
              <Wind className="h-4 w-4 text-amber-400" />
              <span>Summer Loo</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestWeather('heat_haze')}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer',
                weatherOverride === 'heat_haze' || weatherOverride === 'summer_loo'
                  ? 'border-accent bg-accent/15 text-accent shadow-xs font-bold'
                  : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
              )}
            >
              <Flame className="h-4 w-4 text-orange-400" />
              <span>Heat Haze</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestWeather('mist')}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer',
                weatherOverride === 'mist' || weatherOverride === 'winter_fog'
                  ? 'border-accent bg-accent/15 text-accent shadow-xs font-bold'
                  : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
              )}
            >
              <CloudFog className="h-4 w-4 text-slate-400" />
              <span>Winter Fog</span>
            </button>

            <button
              type="button"
              onClick={() => handleTestWeather('clear')}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all cursor-pointer col-span-2 sm:col-span-1',
                weatherOverride === 'clear' || weatherOverride === 'clear_sky'
                  ? 'border-accent bg-accent/15 text-accent shadow-xs font-bold'
                  : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
              )}
            >
              <Sun className="h-4 w-4 text-yellow-400" />
              <span>Clear Sky</span>
            </button>
          </div>
        </SettingsCard>

        {/* Toggle: Weather Effects */}
        <SettingsToggleRow
          icon={CloudRain}
          title="Seasonal Weather & Occasional Rain Effects"
          description="Enables organic rainfall, wind gusts with floating seasonal petals/leaves, and morning mist layers."
          checked={weatherEffects}
          onChange={handleToggleWeatherEffects}
        />
      </SettingsSection>

      {/* ── Dynamic Celestial Atmosphere ───────────────────────────── */}
      <SettingsSection
        title="Celestial Atmosphere & Sky Themes"
        description="Dynamic atmospheric skies with animated celestial bodies, ambient dust, and time-tuned chromatic glows."
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted">Active Atmosphere</span>
          <SettingsBadge variant="accent">
            {!chronoOverride ? 'Auto (Clock Sync)' : `${getThemeCategory(chronoOverride)} Sky`}
          </SettingsBadge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {TIMED_THEMES.map((item) => {
            const IconComp =
              item.id === 'auto'
                ? Clock
                : item.id === 'morning'
                ? Sunrise
                : item.id === 'day'
                ? Sun
                : item.id === 'sunset'
                ? Sunset
                : Moon
            const isSelected =
              (!chronoOverride && item.id === 'auto') ||
              (chronoOverride && getThemeCategory(chronoOverride) === item.id)

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSetChrono(item.id)}
                className={cn(
                  'group relative flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all duration-200 cursor-pointer select-none',
                  isSelected
                    ? 'border-accent bg-accent/15 shadow-glow-xs ring-1 ring-accent/30'
                    : 'border-line/70 bg-surface-2/30 hover:border-line hover:bg-surface-2/60'
                )}
              >
                <div className="flex w-full items-center justify-between mb-2">
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-xl transition-colors',
                      isSelected
                        ? 'bg-accent text-white shadow-xs'
                        : 'bg-surface text-muted group-hover:text-ink'
                    )}
                  >
                    <IconComp className="h-4 w-4" />
                  </span>
                  {isSelected && (
                    <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
                  )}
                </div>
                <span className="font-semibold text-xs text-ink">{item.label}</span>
                <span className="text-xs text-muted/80 leading-tight mt-0.5 line-clamp-2">
                  {item.desc}
                </span>
              </button>
            )
          })}
        </div>

        {/* DEV-only Granular Chrono Slot inspector */}
        {import.meta.env.DEV && (
          <SettingsCard className="mt-4 p-3.5">
            <label className="mb-2 block font-mono text-[calc(0.625rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted/70">
              Developer Chrono Slot Override
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {['live', ...CHRONO_SLOTS].map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSetChrono(slot === 'live' ? 'auto' : slot)}
                  className={cn(
                    'rounded-lg border py-1 px-1.5 font-mono text-[calc(0.625rem*var(--text-scale,1))] font-semibold uppercase tracking-wider transition-colors text-center cursor-pointer',
                    (chronoOverride || 'live') === slot
                      ? 'border-accent/50 bg-accent/20 text-accent shadow-xs'
                      : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
                  )}
                >
                  {slot.replace('_', ' ')}
                </button>
              ))}
            </div>
          </SettingsCard>
        )}
      </SettingsSection>

      {/* ── Typography Scale & Style ────────────────────────────────── */}
      <SettingsSection
        title="Typography & Text Scale"
        description="Tune the proportional sizing and typeface personality across the dashboard."
      >
        <SettingsCard>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
            <div>
              <label className="block text-xs font-semibold text-ink">
                Workspace Sizing & Container Scale
              </label>
              <p className="text-xs text-muted">
                Controls base typography, spacing density, and container sizing across all dashboard views.
              </p>
            </div>
            <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full shrink-0">
              Active: {fontScale.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2" role="radiogroup" aria-label="Font size">
            {[
              { key: 'tiny', label: 'Tiny', sub: '14px · Compact' },
              { key: 'compact', label: 'Compact', sub: '16px · High Density' },
              { key: 'standard', label: 'Standard', sub: '18px · Balanced' },
              { key: 'large', label: 'Large', sub: '20px · Roomy' },
              { key: 'huge', label: 'Huge', sub: '22px · Boosted' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={fontScale === opt.key}
                onClick={() => setFontScale?.(opt.key)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 transition-all text-center cursor-pointer',
                  fontScale === opt.key
                    ? 'border-accent bg-accent/15 text-accent shadow-glow-xs font-bold ring-1 ring-accent/30'
                    : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
                )}
              >
                <span className="text-xs font-bold leading-tight">{opt.label}</span>
                <span className="font-mono text-[calc(0.625rem*var(--text-scale,1))] opacity-75 mt-0.5">{opt.sub}</span>
              </button>
            ))}
          </div>

          {/* Live Container Scale Preview */}
          <div className="mt-3.5 rounded-xl border border-line/50 bg-surface-2/20 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-sans text-xs font-bold text-ink truncate">Live Container Preview</span>
              <SettingsBadge variant="accent">
                {fontScale === 'huge' ? 'Boosted Sizing' : fontScale === 'tiny' ? 'Ultra Compact' : `${fontScale} scale`}
              </SettingsBadge>
            </div>
            <span className="text-xs text-muted text-center sm:text-right">
              Containers, badges, and modals scale proportionally to this root setting.
            </span>
          </div>

          <div className="mt-5 border-t border-line/40 pt-4">
            <label className="mb-2.5 block text-xs font-semibold text-ink">
              Primary Font Family
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: 'dmsans', label: 'DM Sans', desc: 'Signature Sans' },
                { key: 'inter', label: 'Inter', desc: 'Modern Clean' },
                { key: 'outfit', label: 'Outfit', desc: 'Geometric' },
                { key: 'lora', label: 'Lora', desc: 'Scholarly Serif' },
                { key: 'playfair', label: 'Playfair', desc: 'Editorial Serif' },
                { key: 'mono', label: 'JetBrains', desc: 'Coder Mono' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFontFamily?.(opt.key)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl border py-2.5 px-2 transition-all cursor-pointer',
                    fontFamily === opt.key
                      ? 'border-accent bg-accent/15 text-accent shadow-glow-xs font-bold'
                      : 'border-line/60 bg-surface-2/40 text-muted hover:text-ink hover:bg-surface-2'
                  )}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="font-mono text-[calc(0.625rem*var(--text-scale,1))] uppercase tracking-wider opacity-70 mt-0.5">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Performance & Battery ────────────────────────────────────── */}
      <SettingsSection
        title="Performance & Battery"
        description="Optimize GPU rendering and power consumption for laptops or integrated graphics."
      >
        <SettingsCard>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-ink">Eco / Low Power Mode</span>
                {lowPowerMode && <SettingsBadge variant="success">Active</SettingsBadge>}
              </div>
              <p className="text-xs text-muted mt-1 max-w-md">
                Replaces high-cost 140px animated blur layers and active celestial particles with static atmospheric gradients to conserve GPU cycles and laptop battery life.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={lowPowerMode}
              onClick={toggleLowPowerMode}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                lowPowerMode ? 'bg-accent' : 'bg-surface-2 border-line'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out',
                  lowPowerMode ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        </SettingsCard>
      </SettingsSection>

      <WeatherPlaygroundModal
        open={playgroundOpen}
        onClose={() => setPlaygroundOpen(false)}
      />
    </div>
  )
}
