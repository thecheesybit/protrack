import { memo, useMemo, useEffect, useState } from 'react'

/**
 * RainWeatherOverlay
 *
 * Renders dynamic, occasional rainfall with:
 * - Angled rain streaks matching current wind direction
 * - Multiple parallax depth layers (fast foreground & slower background)
 * - Ground ripple splash rings
 * - Occasional ambient distant lightning flash (in monsoon twilight/night)
 */
export const RainWeatherOverlay = memo(function RainWeatherOverlay({
  intensity = 'moderate',
  windAngle = 18,
  seasonId = 'varsha',
  isNight = false,
}) {
  const count = intensity === 'heavy' ? 64 : intensity === 'moderate' ? 44 : 26

  const rainDrops = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${(i * (100 / count) + (i % 7) * 2.3) % 100}%`,
      top: `${(i * 9) % 25}%`,
      len: 24 + (i % 5) * 10,
      dur: 0.9 + (i % 4) * 0.22,
      delay: ((i * 0.17) % 2).toFixed(2),
      opacity: 0.25 + (i % 4) * 0.12,
    }))
  }, [count])

  // Ground splash ripple rings
  const splashRings = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${(i * 8.5 + 4) % 96}%`,
      bottom: `${4 + (i % 3) * 6}%`,
      dur: 1.1 + (i % 3) * 0.25,
      delay: (i * 0.35) % 1.8,
    }))
  }, [])

  // Occasional distant lightning sheet flash in monsoon night/dusk
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (seasonId !== 'varsha' || !isNight) return
    let timer
    let offTimer
    const scheduleFlash = () => {
      timer = setTimeout(() => {
        setFlash(true)
        offTimer = setTimeout(() => setFlash(false), 240)
        scheduleFlash()
      }, 18000 + Math.random() * 32000)
    }
    scheduleFlash()
    return () => {
      if (timer) clearTimeout(timer)
      if (offTimer) clearTimeout(offTimer)
    }
  }, [seasonId, isNight])

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 z-0 max-w-full"
      aria-hidden="true"
      style={{ '--wind-angle': `${windAngle}deg` }}
    >
      {/* ── Distant Monsoon Lightning Sheet Flash (pure composited wash) ── */}
      {flash && (
        <div className="gpu-layer absolute inset-0 bg-sky-100/15 transition-opacity duration-150 animate-pulse pointer-events-none" />
      )}

      {/* ── Subtle Overcast Sky Wash Tint ── */}
      <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />

      {/* ── Falling Angled Rain Streaks ── */}
      {rainDrops.map((r) => (
        <div
          key={r.id}
          className="gpu-layer absolute pointer-events-none"
          style={{
            left: r.left,
            top: r.top,
            animation: `rain-streak ${r.dur}s linear infinite`,
            animationDelay: `${r.delay}s`,
            opacity: r.opacity,
          }}
        >
          <div
            className="w-[1.5px] rounded-full bg-gradient-to-b from-transparent via-sky-300/80 to-sky-200 shadow-[0_0_2px_rgba(56,189,248,0.4)]"
            style={{
              height: `${r.len}px`,
              transform: `rotate(${windAngle}deg)`,
              transformOrigin: 'top center',
            }}
          />
        </div>
      ))}

      {/* ── Bottom Ground Water Splash Ripples ── */}
      {splashRings.map((s) => (
        <div
          key={s.id}
          className="gpu-layer absolute rounded-full border border-sky-300/30 animate-[ping_1.6s_cubic-bezier(0,0,0.2,1)_infinite] pointer-events-none"
          style={{
            left: s.left,
            bottom: s.bottom,
            width: '14px',
            height: '6px',
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            opacity: 0.35,
          }}
        />
      ))}
    </div>
  )
})
