import { memo, useState, useEffect, useRef } from 'react'

const rnd = (min, max) => min + Math.random() * (max - min)
const uid = () => Math.random().toString(36).slice(2)

/**
 * Realistic handcrafted SVG Butterfly component.
 * Features dual independent wings with physics-based flapping keyframes
 * along with delicate veins and antenna details.
 */
export const Butterfly = memo(function Butterfly({
  color = 'gold', // 'gold' | 'azure'
  scale = 1,
  flapSpeed = '0.18s',
  className = '',
  style = {},
}) {
  const isAzure = color === 'azure'
  const wingGradId = isAzure ? 'azure-morpho-wing' : 'gold-swallowtail-wing'

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ transform: `scale(${scale})`, ...style }}
    >
      <svg width="34" height="26" viewBox="0 0 34 26" fill="none" className="overflow-visible drop-shadow-sm">
        <defs>
          <linearGradient id="gold-swallowtail-wing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="90%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="azure-morpho-wing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="40%" stopColor="#38bdf8" />
            <stop offset="90%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {/* ── Left Wing (Flaps along right origin) ── */}
        <g
          className="origin-[16px_13px] animate-[wing-flap-left_0.18s_ease-in-out_infinite]"
          style={{ animationDuration: flapSpeed }}
        >
          {/* Forewing */}
          <path
            d="M16 13 C14 8, 8 1, 2 3 C-1 5, 0 11, 4 14 C8 17, 13 15, 16 13 Z"
            fill={`url(#${wingGradId})`}
            opacity="0.88"
          />
          {/* Hindwing */}
          <path
            d="M16 13 C12 14, 5 16, 4 21 C3 25, 10 25, 13 21 C15 18, 15.5 15, 16 13 Z"
            fill={`url(#${wingGradId})`}
            opacity="0.8"
          />
          {/* Wing veins & dark border */}
          <path
            d="M16 13 C10 8, 5 6, 2 4 M16 13 C10 16, 6 19, 5 22"
            stroke="#1c1917"
            strokeWidth="0.6"
            strokeOpacity="0.45"
          />
        </g>

        {/* ── Right Wing (Flaps along left origin) ── */}
        <g
          className="origin-[18px_13px] animate-[wing-flap-right_0.18s_ease-in-out_infinite]"
          style={{ animationDuration: flapSpeed }}
        >
          {/* Forewing */}
          <path
            d="M18 13 C20 8, 26 1, 32 3 C35 5, 34 11, 30 14 C26 17, 21 15, 18 13 Z"
            fill={`url(#${wingGradId})`}
            opacity="0.88"
          />
          {/* Hindwing */}
          <path
            d="M18 13 C22 14, 29 16, 30 21 C31 25, 24 25, 21 21 C19 18, 18.5 15, 18 13 Z"
            fill={`url(#${wingGradId})`}
            opacity="0.8"
          />
          {/* Wing veins & dark border */}
          <path
            d="M18 13 C24 8, 29 6, 32 4 M18 13 C24 16, 28 19, 29 22"
            stroke="#1c1917"
            strokeWidth="0.6"
            strokeOpacity="0.45"
          />
        </g>

        {/* ── Slender Body (Thorax, Abdomen & Antennae) ── */}
        <ellipse cx="17" cy="13" rx="1.2" ry="6" fill="#1c1917" opacity="0.85" />
        <circle cx="17" cy="6" r="1.1" fill="#1c1917" opacity="0.9" />
        {/* Antennae */}
        <path
          d="M16.5 5.5 Q14 2 12 2.5 M17.5 5.5 Q20 2 22 2.5"
          stroke="#1c1917"
          strokeWidth="0.55"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
    </div>
  )
})

function makeRandomButterfly(color) {
  const dir = Math.random() < 0.5 ? 'ltr' : 'rtl'
  const startTop = rnd(22, 72)
  const driftY = rnd(-16, 16)
  const dur = rnd(20, 34)
  const scale = rnd(0.7, 0.95)
  const flapSpeed = `${rnd(0.14, 0.2).toFixed(2)}s`

  return {
    id: uid(),
    dir,
    top: `${startTop.toFixed(1)}%`,
    driftY: `${driftY.toFixed(1)}vh`,
    dur: `${dur.toFixed(1)}s`,
    scale,
    flapSpeed,
    color,
  }
}

/**
 * Animated butterfly flock with 100% randomized, non-repeating movements:
 * - Dynamic spawning at random time intervals
 * - Randomized 50/50 flight directions (left-to-right or right-to-left)
 * - Randomized altitudes, drift vectors, flight speeds, scales, and wing flutter rates
 * - Self-cleaning on animationend so nothing ever repeats.
 */
export const ButterflyFlock = memo(function ButterflyFlock({
  active = true,
  color = 'gold',
  butterflies: externalButterflies,
}) {
  const [butterflies, setButterflies] = useState(() => {
    if (externalButterflies) return externalButterflies
    return []
  })

  useEffect(() => {
    if (externalButterflies || !active) return undefined

    let timer
    const scheduleNext = (delayMs) => {
      timer = setTimeout(() => {
        setButterflies((list) => {
          if (list.length >= 1) return list
          return [...list, makeRandomButterfly(color)]
        })
        scheduleNext(rnd(85000, 160000))
      }, delayMs)
    }

    // Gentle initial delay before the first butterfly sighting
    scheduleNext(rnd(20000, 45000))
    return () => clearTimeout(timer)
  }, [active, color, externalButterflies])

  const removeButterfly = (id) => {
    setButterflies((list) => list.filter((b) => b.id !== id))
  }

  const itemsToRender = externalButterflies || butterflies

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {itemsToRender.map((b) => {
        const animClass = b.dir === 'rtl' ? 'animate-[butterfly-fly-rtl_linear_forwards]' : 'animate-[butterfly-fly-ltr_linear_forwards]'
        return (
          <div
            key={b.id}
            className={`absolute ${animClass}`}
            style={{
              top: b.top,
              '--drift-y': b.driftY || '0px',
              animationDuration: b.dur || '28s',
              animationDelay: b.delay || '0s',
            }}
            onAnimationEnd={() => removeButterfly(b.id)}
          >
            <Butterfly
              color={b.color || color}
              scale={b.scale || 1}
              flapSpeed={b.flapSpeed || '0.18s'}
            />
          </div>
        )
      })}
    </div>
  )
})
