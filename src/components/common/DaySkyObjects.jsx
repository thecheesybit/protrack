import { memo, useMemo, useState, useEffect } from 'react'
import { ButterflyFlock } from './ButterflyFlock'

const rnd = (min, max) => min + Math.random() * (max - min)
const uid = () => Math.random().toString(36).slice(2)

function makeHawkPass() {
  const dir = Math.random() < 0.5 ? 'ltr' : 'rtl'
  const top = rnd(12, 32)
  const driftY = rnd(-10, 10)
  const dur = rnd(40, 58)
  return {
    id: uid(),
    dir,
    top: `${top.toFixed(1)}%`,
    driftY: `${driftY.toFixed(1)}vh`,
    dur: `${dur.toFixed(1)}s`,
  }
}

function makeDandelionSeed() {
  const dir = Math.random() < 0.5 ? 'ltr' : 'rtl'
  const top = rnd(25, 75)
  const driftY = rnd(-16, 16)
  const dur = rnd(22, 38)
  const scale = rnd(0.7, 0.95)
  return {
    id: uid(),
    dir,
    top: `${top.toFixed(1)}%`,
    driftY: `${driftY.toFixed(1)}vh`,
    dur: `${dur.toFixed(1)}s`,
    scale,
  }
}

const CLOUD_PATHS = [
  'M25 45 a20 20 0 0 1 35 -10 a28 28 0 0 1 50 -6 a22 22 0 0 1 35 12 a18 18 0 0 1 5 14 a15 15 0 0 1 -15 15 l-100 0 a15 15 0 0 1 -10 -25 z',
  'M20 50 a18 18 0 0 1 30 -12 a25 25 0 0 1 45 -4 a20 20 0 0 1 32 10 a16 16 0 0 1 12 16 l-110 0 a14 14 0 0 1 -9 -20 z',
  'M15 35 a15 15 0 0 1 25 -8 a22 22 0 0 1 38 -2 a18 18 0 0 1 28 8 l-85 0 a12 12 0 0 1 -6 -6 z',
]

/**
 * Day Sky Ambient Objects:
 * - Radiant Sun with pulsing corona and rotating sunbeams
 * - Layered fluffy cumulus clouds drifting at parallax speeds
 * - Gentle ambient raindrops falling softly
 * - Dynamic, non-repeating soaring thermal hawks (randomized headings, altitudes & timing)
 * - Dynamic, non-repeating Azure Morpho butterflies (50/50 randomized directions & paths)
 * - Dynamic floating dandelion seeds drifting across the breeze
 */
export const DaySkyObjects = memo(function DaySkyObjects() {
  // Dynamic non-repeating soaring hawk passes
  const [hawkPasses, setHawkPasses] = useState(() => [])

  useEffect(() => {
    let timer
    const scheduleNext = (delayMs) => {
      timer = setTimeout(() => {
        setHawkPasses((list) => {
          if (list.length >= 1) return list
          return [...list, makeHawkPass()]
        })
        scheduleNext(rnd(140000, 280000))
      }, delayMs)
    }

    // Majestic high-altitude raptor: occasional, majestic appearance
    scheduleNext(rnd(45000, 90000))
    return () => clearTimeout(timer)
  }, [])

  const removeHawkPass = (id) => {
    setHawkPasses((list) => list.filter((h) => h.id !== id))
  }

  // Dynamic floating dandelion seeds
  const [dandelionSeeds, setDandelionSeeds] = useState(() => [])

  useEffect(() => {
    let timer
    const scheduleNext = (delayMs) => {
      timer = setTimeout(() => {
        setDandelionSeeds((list) => {
          if (list.length >= 1) return list
          return [...list, makeDandelionSeed()]
        })
        scheduleNext(rnd(90000, 180000))
      }, delayMs)
    }

    // Rare, gentle dandelion seed drifting on the afternoon breeze
    scheduleNext(rnd(35000, 70000))
    return () => clearTimeout(timer)
  }, [])

  const removeDandelionSeed = (id) => {
    setDandelionSeeds((list) => list.filter((d) => d.id !== id))
  }

  const clouds = useMemo(() => [
    { id: 1, top: '8%', pathIdx: 0, scale: 1.25, dur: '85s', delay: '0s', opacity: 0.35, anim: 'cloud-drift-slow' },
    { id: 2, top: '22%', pathIdx: 1, scale: 0.95, dur: '65s', delay: '-25s', opacity: 0.28, anim: 'cloud-drift-mid' },
    { id: 3, top: '14%', pathIdx: 2, scale: 1.4, dur: '110s', delay: '-50s', opacity: 0.3, anim: 'cloud-drift-slow' },
    { id: 4, top: '32%', pathIdx: 0, scale: 0.85, dur: '75s', delay: '-15s', opacity: 0.22, anim: 'cloud-drift-mid' },
  ], [])

  const rainDrops = useMemo(() => {
    return Array.from({ length: 32 }, (_, i) => ({
      id: i,
      left: `${(i * 3.1 + (i % 5) * 2) % 100}%`,
      top: `${(i * 7) % 30}%`,
      len: 20 + (i % 4) * 8,
      dur: 1.2 + (i % 5) * 0.2,
      delay: (i * 0.18) % 2.5,
      opacity: 0.18 + (i % 3) * 0.08,
    }))
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* ── Soft Ambient Daylight Sun ── */}
      <div className="absolute right-[12%] top-[7%] select-none pointer-events-none">
        <div className="absolute -inset-24 rounded-full bg-amber-400/10 blur-3xl animate-[sun-pulse_7s_ease-in-out_infinite]" />
        <div className="absolute -inset-12 rounded-full bg-yellow-300/12 blur-2xl animate-[sun-pulse_5s_ease-in-out_infinite]" />
        <div className="absolute -inset-20 rounded-full border border-yellow-200/20 animate-[solar-halo-pulse_12s_ease-in-out_infinite]" />

        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          className="absolute -inset-10 animate-[sun-ray-spin_140s_linear_infinite] opacity-20"
        >
          <g transform="translate(80, 80)">
            {Array.from({ length: 12 }).map((_, i) => (
              <line
                key={i}
                x1="0"
                y1="-44"
                x2="0"
                y2={i % 2 === 0 ? '-68' : '-58'}
                stroke="url(#sun-ray-grad)"
                strokeWidth={i % 2 === 0 ? '2' : '1'}
                strokeLinecap="round"
                transform={`rotate(${i * 30})`}
              />
            ))}
          </g>
          <defs>
            <linearGradient id="sun-ray-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div
          className="relative h-22 w-22 rounded-full blur-md opacity-75 animate-[sun-pulse_9s_ease-in-out_infinite]"
          style={{
            background: 'radial-gradient(circle, rgba(254, 240, 138, 0.75) 0%, rgba(251, 191, 36, 0.35) 50%, rgba(245, 158, 11, 0.1) 75%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-3 rounded-full blur-lg opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.8) 0%, rgba(254, 240, 138, 0.3) 60%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Layered Drifting Clouds ── */}
      {clouds.map((c) => (
        <div
          key={c.id}
          className={`absolute ${c.anim}`}
          style={{
            top: c.top,
            opacity: c.opacity,
            transform: `scale(${c.scale})`,
            animationDuration: c.dur,
            animationDelay: c.delay,
          }}
        >
          <svg width="180" height="90" viewBox="0 0 160 80" className="fill-white/65 filter drop-shadow-sm">
            <path d={CLOUD_PATHS[c.pathIdx]} />
          </svg>
        </div>
      ))}

      {/* ── Soft Ambient Rain Droplets ── */}
      <div className="absolute inset-0">
        {rainDrops.map((r) => (
          <div
            key={r.id}
            className="absolute"
            style={{
              left: r.left,
              top: r.top,
              animation: `rain-streak ${r.dur}s linear infinite`,
              animationDelay: `${r.delay}s`,
              opacity: r.opacity,
            }}
          >
            <div
              className="w-[1.5px] rounded-full bg-gradient-to-b from-transparent via-sky-300/70 to-sky-400"
              style={{ height: r.len, transform: 'rotate(18deg)' }}
            />
          </div>
        ))}
      </div>

      {/* ── High-Altitude Soaring Thermal Hawks (Dynamic Non-Repeating Passages) ── */}
      {hawkPasses.map((hp) => (
        <div
          key={hp.id}
          className={`absolute ${hp.dir === 'rtl' ? 'animate-[hawk-soar-rtl_linear_forwards]' : 'animate-[hawk-soar-ltr_linear_forwards]'}`}
          style={{
            top: hp.top,
            '--drift-y': hp.driftY,
            animationDuration: hp.dur,
          }}
          onAnimationEnd={() => removeHawkPass(hp.id)}
        >
          <svg width="26" height="12" viewBox="0 0 26 12" className="fill-slate-800/40 drop-shadow-sm">
            <path d="M0,4 Q7,-1 13,3 Q19,-1 26,4 Q21,7 13,8 Q5,7 0,4 Z M13,8 L10,12 L16,12 Z" />
          </svg>
        </div>
      ))}

      {/* ── Floating Dandelion Fluff Drifting on the Breeze (Dynamic Spawns) ── */}
      {dandelionSeeds.map((d) => (
        <div
          key={d.id}
          className={`absolute ${d.dir === 'rtl' ? 'animate-[dandelion-drift-rtl_linear_forwards]' : 'animate-[dandelion-drift-ltr_linear_forwards]'}`}
          style={{
            top: d.top,
            '--drift-y': d.driftY,
            animationDuration: d.dur,
            transform: `scale(${d.scale})`,
          }}
          onAnimationEnd={() => removeDandelionSeed(d.id)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" className="stroke-white/40 fill-white/60">
            <line x1="7" y1="7" x2="7" y2="13" strokeWidth="0.8" stroke="rgba(255,255,255,0.4)" />
            <circle cx="7" cy="7" r="1.2" fill="rgba(255,255,255,0.7)" />
            <line x1="7" y1="7" x2="2" y2="3" strokeWidth="0.5" />
            <line x1="7" y1="7" x2="7" y2="1" strokeWidth="0.5" />
            <line x1="7" y1="7" x2="12" y2="3" strokeWidth="0.5" />
            <line x1="7" y1="7" x2="4" y2="5" strokeWidth="0.5" />
            <line x1="7" y1="7" x2="10" y2="5" strokeWidth="0.5" />
          </svg>
        </div>
      ))}

      {/* ── Dynamic Non-Repeating Azure Morpho Butterflies ── */}
      <ButterflyFlock color="azure" />
    </div>
  )
})
