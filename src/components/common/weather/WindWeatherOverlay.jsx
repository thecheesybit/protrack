import { memo, useMemo } from 'react'

/**
 * WindWeatherOverlay
 *
 * Renders atmospheric wind dynamics and floating seasonal botanicals:
 * - Spring (Vasant): Floating flower petals (pink/marigold) & pollen
 * - Summer (Grishma): Hot gusty Loo winds carrying dry leaves & dust motes
 * - Autumn (Sharad): Golden tumbling leaves in gentle breezes
 * - Monsoon (Varsha): Moisture wisps & fast wind stream lines
 * - Winter (Shishir): Crisp sparkling frost motes
 */
export const WindWeatherOverlay = memo(function WindWeatherOverlay({
  seasonId = 'vasant',
  windSpeed = 16,
  hasWindGusts = false,
}) {
  const isSummer = seasonId === 'grishma'
  const isSpring = seasonId === 'vasant'
  const isAutumn = seasonId === 'sharad'
  const isWinter = seasonId === 'shishir' || seasonId === 'hemant'
  const isMonsoon = seasonId === 'varsha'

  // Higher windSpeed → shorter animation duration (faster drift). 16 km/h is
  // the prop default and the speed the base durations below were tuned for,
  // so it maps to a 1x factor; clamped so a calm 8 km/h doesn't crawl to a
  // stop and a 48 km/h squall doesn't turn into a strobe.
  const speedFactor = Math.min(1.8, Math.max(0.45, 16 / (windSpeed || 16)))

  // Stable particle dataset: prevents animation pops or resets when weather values update
  const particles = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      top: `${15 + (i * 7.5 + (i % 3) * 4) % 70}%`,
      dur: (16 + (i % 5) * 4) * speedFactor,
      delay: (i * 1.8) % 12,
      scale: 0.7 + (i % 3) * 0.25,
      driftY: (i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 8),
      isGustOnly: i >= 10,
    }))
  }, [speedFactor])

  // Aerodynamic wind streamlines that surge during gusts
  const windLines = useMemo(() => {
    if (!hasWindGusts) return []
    return [
      { id: 1, top: '22%', dur: 8 * speedFactor, delay: 0 },
      { id: 2, top: '46%', dur: 6.5 * speedFactor, delay: 2.5 },
      { id: 3, top: '68%', dur: 7.5 * speedFactor, delay: 4.8 },
    ]
  }, [hasWindGusts, speedFactor])

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden z-0 max-w-full"
      aria-hidden="true"
    >
      {/* ── Wind Stream Lines during Gusts ── */}
      {windLines.map((w) => (
        <div
          key={w.id}
          className="gpu-layer absolute left-0 right-0 h-[1.5px] pointer-events-none"
          style={{
            top: w.top,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 35%, rgba(255,255,255,0.05) 75%, transparent 100%)',
            animation: `cloud-drift-mid ${w.dur}s ease-in-out infinite`,
            animationDelay: `${w.delay}s`,
            opacity: 0.35,
          }}
        />
      ))}

      {/* ── Floating Seasonal Botanicals & Airborne Elements ── */}
      {particles.map((p) => {
        if (p.isGustOnly && !hasWindGusts) return null
        return (
          <div
            key={p.id}
            className="gpu-layer absolute animate-[butterfly-flight-path_linear_infinite] pointer-events-none transition-opacity duration-700"
            style={{
              top: p.top,
              animationDuration: `${p.dur}s`,
              animationDelay: `-${p.delay}s`,
            }}
          >
            <div
              className="pointer-events-none"
              style={{
                transform: `scale(${p.scale})`,
              }}
            >
              {/* Spring: Flower Petal */}
              {isSpring && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  className="animate-spin-slow opacity-75"
                  style={{ animationDuration: '9s' }}
                >
                  <path
                    d="M7 1 C9 4 11 8 7 13 C3 8 5 4 7 1 Z"
                    fill={p.id % 2 === 0 ? '#f472b6' : '#fef08a'}
                    opacity="0.8"
                  />
                </svg>
              )}

              {/* Summer: Dry Leaf / Dust Mote in Loo */}
              {isSummer && (
                <svg
                  width="12"
                  height="10"
                  viewBox="0 0 12 10"
                  className="animate-[flora-sway_4s_ease-in-out_infinite] opacity-60"
                >
                  <path
                    d="M1 5 Q6 1 11 5 Q6 9 1 5 Z"
                    fill={p.id % 2 === 0 ? '#d97706' : '#b45309'}
                    opacity="0.75"
                  />
                </svg>
              )}

              {/* Autumn: Golden Amber Leaf */}
              {isAutumn && (
                <svg
                  width="14"
                  height="12"
                  viewBox="0 0 14 12"
                  className="animate-[flora-sway_5s_ease-in-out_infinite] opacity-70"
                >
                  <path
                    d="M2 6 C5 1 10 2 12 6 C10 10 5 11 2 6 Z"
                    fill="#f59e0b"
                    opacity="0.85"
                  />
                </svg>
              )}

              {/* Winter: Frost Sparkle Crystal */}
              {isWinter && (
                <div
                  className="h-1.5 w-1.5 rounded-full bg-sky-200 shadow-[0_0_6px_rgba(186,230,253,0.8)] opacity-55 animate-pulse"
                  style={{ animationDuration: '3.5s' }}
                />
              )}

              {/* Monsoon: Vapor Moisture Wisp */}
              {isMonsoon && (
                <div
                  className="h-2 w-5 rounded-full bg-sky-300/30 blur-[1px] opacity-45"
                />
              )}
            </div>
          </div>
      )
    })}
    </div>
  )
})
