import { memo, useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { getThemeCategory } from '@/hooks/useChronoTheme'
import { useLowPowerMode } from '@/lib/lowPower'
import { SpaceObjects } from './SpaceObjects'
import { DaySkyObjects } from './DaySkyObjects'
import { DawnSkyObjects } from './DawnSkyObjects'
import { DuskSkyObjects } from './DuskSkyObjects'
import { RainWeatherOverlay } from './weather/RainWeatherOverlay'
import { WindWeatherOverlay } from './weather/WindWeatherOverlay'
import { FogMistOverlay } from './weather/FogMistOverlay'
import { HeatHazeOverlay } from './weather/HeatHazeOverlay'
import {
  getActiveIndianSeason,
  computeWeatherState,
  isWeatherEffectsEnabled,
  CLIMATE_OVERRIDE_EVENT,
} from '@/lib/indianClimate'

/**
 * Deterministic starfield — fixed seed so the sky never re-shuffles between
 * renders. Visibility rides `--stars-opacity` (0 in light slots; up to 0.9 at
 * deep night), so the layer costs nothing while invisible.
 */
const STARS = (() => {
  let seed = 42
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 110 }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 70,
    r: rand() < 0.8 ? 0.9 : 1.6,
    delay: rand() * 5,
    dur: 2.2 + rand() * 4.5,
  }))
})()

/**
 * Ambient canvas behind the app:
 * - Time-adaptive celestial objects (Space, Day, Dawn, Dusk)
 * - Indian Climate & Seasonal Weather System:
 *    • Occasional rain showers (mostly in Monsoon, passing intervals)
 *    • Wind & seasonal drifting particles (spring petals, summer Loo dust/leaves, autumn leaves)
 *    • Winter morning fog & mist (Kohra)
 *    • Summer midday heat haze & mirage shimmer
 */
export const AuroraBackground = memo(function AuroraBackground({ showCelestial = true }) {
  const chronoSlot = useStore((s) => s.chronoSlot)
  const category = getThemeCategory(chronoSlot)
  const [isLowPower] = useLowPowerMode()

  const [season, setSeason] = useState(() => getActiveIndianSeason())
  const [weather, setWeather] = useState(() => computeWeatherState(getActiveIndianSeason().id))
  const [effectsEnabled, setEffectsEnabled] = useState(() => isWeatherEffectsEnabled())

  useEffect(() => {
    const updateWeather = () => {
      const activeSeason = getActiveIndianSeason()
      const nextWeather = computeWeatherState(activeSeason.id)
      const nextEffects = isWeatherEffectsEnabled()

      setSeason((prev) => (prev?.id === activeSeason.id ? prev : activeSeason))
      setWeather((prev) => {
        if (
          prev &&
          prev.condition === nextWeather.condition &&
          prev.intensity === nextWeather.intensity &&
          prev.isRaining === nextWeather.isRaining &&
          prev.hasFog === nextWeather.hasFog &&
          prev.hasHeatHaze === nextWeather.hasHeatHaze &&
          prev.hasWindGusts === nextWeather.hasWindGusts &&
          prev.windSpeed === nextWeather.windSpeed &&
          prev.windAngle === nextWeather.windAngle
        ) {
          return prev
        }
        return nextWeather
      })
      setEffectsEnabled((prev) => (prev === nextEffects ? prev : nextEffects))
    }

    updateWeather()
    const timer = setInterval(updateWeather, 60 * 1000)
    window.addEventListener(CLIMATE_OVERRIDE_EVENT, updateWeather)

    return () => {
      clearInterval(timer)
      window.removeEventListener(CLIMATE_OVERRIDE_EVENT, updateWeather)
    }
  }, [])

  const isNight = category === 'night' || chronoSlot === 'dusk' || chronoSlot === 'deep_night'

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />

      {/* Sky wash — the slot's signature gradient breathing down from the top. */}
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
        style={{ background: 'var(--sky-wash, transparent)' }}
      />

      {/* Starfield — active in the dark starry slots. */}
      <svg
        className="absolute inset-0 h-full w-full transition-opacity duration-[1500ms] ease-out"
        style={{ opacity: 'var(--stars-opacity, 0)' }}
        aria-hidden="true"
      >
        {STARS.map((s) => (
          <circle
            key={s.id}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            className="animate-twinkle fill-white"
            style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
          />
        ))}
      </svg>

      {/* ── 4 Unique Timed Celestial & Atmospheric Sky Systems ── */}
      {!isLowPower && showCelestial && category === 'night' && <SpaceObjects />}
      {!isLowPower && showCelestial && category === 'day' && <DaySkyObjects />}
      {!isLowPower && showCelestial && category === 'morning' && <DawnSkyObjects />}
      {!isLowPower && showCelestial && category === 'sunset' && <DuskSkyObjects />}

      {/* ── Indian Climate & Procedural Weather Overlays ── */}
      {!isLowPower && showCelestial && effectsEnabled && (
        <>
          {/* Occasional Rain (active when weather state is raining) */}
          {weather.isRaining && (
            <RainWeatherOverlay
              intensity={weather.intensity}
              windAngle={weather.windAngle}
              seasonId={season.id}
              isNight={isNight}
            />
          )}

          {/* Seasonal Wind & Drifting Particles */}
          <WindWeatherOverlay
            seasonId={season.id}
            windSpeed={weather.windSpeed}
            hasWindGusts={weather.hasWindGusts}
          />

          {/* Winter Morning Mist / Fog (Kohra) */}
          {weather.hasFog && <FogMistOverlay intensity={weather.intensity} />}

          {/* Summer Midday Heat Haze */}
          {weather.hasHeatHaze && <HeatHazeOverlay />}
        </>
      )}

      {/* Ambient layer — intensity rides the chrono slot (dimmer at night). */}
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: 'var(--aurora-opacity, 1)' }}
      >
        <div className="absolute inset-0 bg-grid opacity-30" />
        {isLowPower ? (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.08)_0%,transparent_70%)]" />
        ) : (
          <>
            <div className="gpu-layer absolute -left-40 -top-40 h-[40rem] w-[40rem] animate-aurora rounded-full bg-accent/15 blur-[90px]" />
            <div
              className="gpu-layer absolute -right-40 top-1/4 h-[36rem] w-[36rem] animate-aurora rounded-full bg-accent-2/12 blur-[90px]"
              style={{ animationDelay: '-7s' }}
            />
            <div
              className="gpu-layer absolute bottom-0 left-1/3 h-[32rem] w-[32rem] animate-aurora rounded-full bg-accent/10 blur-[100px]"
              style={{ animationDelay: '-14s' }}
            />
          </>
        )}
      </div>

      {/* Top vignette for depth, so chrome reads cleanly over content. */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/20 to-transparent dark:from-black/40" />
    </div>
  )
})
