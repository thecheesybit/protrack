import { memo, useMemo, useState, useEffect } from 'react'
import { ButterflyFlock } from './ButterflyFlock'
import { SoaringBirdSilhouette } from './SkySprites'
import { getActiveIndianSeason, CLIMATE_OVERRIDE_EVENT } from '@/lib/indianClimate'

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
 * - Season-adapted Daylight Sun (blazing in Summer, mellow in Winter, golden in Spring)
 * - Layered fluffy cumulus clouds drifting at parallax speeds
 * - Dynamic soaring thermal raptors (occasional passages)
 * - Dynamic Azure Morpho butterflies
 * - Dynamic floating dandelion seeds
 * Note: Rain is no longer hardcoded 24/7; it is driven dynamically by the Indian Climate Engine!
 */
export const DaySkyObjects = memo(function DaySkyObjects() {
  const [season, setSeason] = useState(() => getActiveIndianSeason())

  useEffect(() => {
    const onClimateChange = () => setSeason(getActiveIndianSeason())
    window.addEventListener(CLIMATE_OVERRIDE_EVENT, onClimateChange)
    return () => window.removeEventListener(CLIMATE_OVERRIDE_EVENT, onClimateChange)
  }, [])

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

    scheduleNext(rnd(35000, 70000))
    return () => clearTimeout(timer)
  }, [])

  const removeDandelionSeed = (id) => {
    setDandelionSeeds((list) => list.filter((d) => d.id !== id))
  }

  // Cloud density adapts to the season: denser in Monsoon, clearer in Summer/Spring
  const clouds = useMemo(() => {
    const isMonsoon = season.id === 'varsha'
    const isSummer = season.id === 'grishma'
    const opMultiplier = isMonsoon ? 1.4 : isSummer ? 0.7 : 1.0

    return [
      { id: 1, top: '8%', pathIdx: 0, scale: 1.25, dur: '85s', delay: '0s', opacity: 0.35 * opMultiplier, anim: 'cloud-drift-slow' },
      { id: 2, top: '22%', pathIdx: 1, scale: 0.95, dur: '65s', delay: '-25s', opacity: 0.28 * opMultiplier, anim: 'cloud-drift-mid' },
      { id: 3, top: '14%', pathIdx: 2, scale: 1.4, dur: '110s', delay: '-50s', opacity: 0.3 * opMultiplier, anim: 'cloud-drift-slow' },
      { id: 4, top: '32%', pathIdx: 0, scale: 0.85, dur: '75s', delay: '-15s', opacity: 0.22 * opMultiplier, anim: 'cloud-drift-mid' },
    ]
  }, [season.id])

  const isSummer = season.id === 'grishma'
  const isWinter = season.id === 'shishir' || season.id === 'hemant'

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden max-w-full" aria-hidden="true">
      {/* ── Season-Adapted Ambient Daylight Sun ── */}
      <div className="gpu-layer absolute right-[12%] top-[7%] select-none pointer-events-none">
        <div
          className={`absolute -inset-24 rounded-full blur-3xl animate-[sun-pulse_7s_ease-in-out_infinite] ${
            isSummer ? 'bg-orange-500/20' : isWinter ? 'bg-amber-300/10' : 'bg-amber-400/12'
          }`}
        />
        <div
          className={`absolute -inset-12 rounded-full blur-2xl animate-[sun-pulse_5s_ease-in-out_infinite] ${
            isSummer ? 'bg-yellow-400/20' : 'bg-yellow-300/12'
          }`}
        />
        <div className="absolute -inset-20 rounded-full border border-yellow-200/20 animate-[solar-halo-pulse_12s_ease-in-out_infinite]" />

        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          className="absolute -inset-10 animate-[sun-ray-spin_140s_linear_infinite] opacity-25"
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
              <stop offset="0%" stopColor={isSummer ? '#f97316' : '#f59e0b'} stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div
          className="relative h-22 w-22 rounded-full blur-md opacity-75 animate-[sun-pulse_9s_ease-in-out_infinite]"
          style={{
            background: isSummer
              ? 'radial-gradient(circle, rgba(254, 240, 138, 0.9) 0%, rgba(251, 146, 60, 0.5) 50%, rgba(239, 68, 68, 0.2) 75%, transparent 100%)'
              : 'radial-gradient(circle, rgba(254, 240, 138, 0.75) 0%, rgba(251, 191, 36, 0.35) 50%, rgba(245, 158, 11, 0.1) 75%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-3 rounded-full blur-lg opacity-60"
          style={{
            background: 'radial-gradient(circle, #fef08a 0%, #fbbf24 60%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-5 rounded-full shadow-[0_0_24px_rgba(253,224,71,0.9)]"
          style={{
            background: 'radial-gradient(circle, #ffffff 10%, #fef08a 45%, #f59e0b 95%)',
          }}
        />
      </div>

      {/* ── Season-Adapted Cloud Formations ── */}
      {clouds.map((c) => (
        <div
          key={c.id}
          className={`gpu-layer absolute ${c.anim}`}
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

      {/* ── High-Altitude Soaring Thermal Raptors ── */}
      {hawkPasses.map((hp) => (
        <div
          key={hp.id}
          className={`gpu-layer absolute ${hp.dir === 'rtl' ? 'animate-[hawk-soar-rtl_linear_forwards]' : 'animate-[hawk-soar-ltr_linear_forwards]'}`}
          style={{
            top: hp.top,
            '--drift-y': hp.driftY,
            animationDuration: hp.dur,
          }}
          onAnimationEnd={() => removeHawkPass(hp.id)}
        >
          <SoaringBirdSilhouette className="fill-slate-800/40 drop-shadow-sm" />
        </div>
      ))}

      {/* ── Floating Dandelion Fluff Drifting on the Breeze ── */}
      {dandelionSeeds.map((d) => (
        <div
          key={d.id}
          className={`gpu-layer absolute ${d.dir === 'rtl' ? 'animate-[dandelion-drift-rtl_linear_forwards]' : 'animate-[dandelion-drift-ltr_linear_forwards]'}`}
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
