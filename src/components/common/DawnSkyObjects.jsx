import { memo, useMemo, useState, useEffect } from 'react'
import { ButterflyFlock } from './ButterflyFlock'
import { SwallowSilhouette } from './SkySprites'

const rnd = (min, max) => min + Math.random() * (max - min)
const uid = () => Math.random().toString(36).slice(2)

function makeSwallowPass() {
  const dir = Math.random() < 0.6 ? 'ltr' : 'rtl'
  const top = rnd(18, 45)
  const driftY = rnd(-14, 14)
  const dur = rnd(28, 42)
  return {
    id: uid(),
    dir,
    top: `${top.toFixed(1)}%`,
    driftY: `${driftY.toFixed(1)}vh`,
    dur: `${dur.toFixed(1)}s`,
  }
}

/**
 * Morning / Dawn Sky Ambient Objects:
 * - Warm golden-rose rising sun on the horizon
 * - Crepuscular diagonal sunbeams (god rays)
 * - Soft pastel morning mist clouds
 * - Dynamic, non-repeating morning swallow flights (random altitudes, headings & intervals)
 * - Dynamic, non-repeating Golden Swallowtail butterflies (50/50 randomized directions & paths)
 */
export const DawnSkyObjects = memo(function DawnSkyObjects() {
  // Dynamic non-repeating swallow passes across the morning sky
  const [swallowPasses, setSwallowPasses] = useState(() => [])

  useEffect(() => {
    let timer
    const scheduleNext = (delayMs) => {
      timer = setTimeout(() => {
        setSwallowPasses((list) => {
          if (list.length >= 1) return list
          return [...list, makeSwallowPass()]
        })
        scheduleNext(rnd(110000, 220000))
      }, delayMs)
    }

    // Peaceful initial delay before the first morning bird formation
    scheduleNext(rnd(30000, 60000))
    return () => clearTimeout(timer)
  }, [])

  const removeSwallowPass = (id) => {
    setSwallowPasses((list) => list.filter((p) => p.id !== id))
  }

  const mistClouds = useMemo(() => [
    { id: 1, top: '48%', scale: 1.6, dur: '95s', delay: '0s', opacity: 0.25 },
    { id: 2, top: '56%', scale: 2.1, dur: '120s', delay: '-40s', opacity: 0.2 },
    { id: 3, top: '64%', scale: 1.8, dur: '80s', delay: '-20s', opacity: 0.22 },
  ], [])

  // Early morning swallow flock layout
  const morningBirds = useMemo(() => [
    { id: 1, dx: 0, dy: 0, scale: 0.9, flapDelay: '0s' },
    { id: 2, dx: 30, dy: 16, scale: 0.75, flapDelay: '-0.35s' },
    { id: 3, dx: 54, dy: -8, scale: 0.65, flapDelay: '-0.7s' },
  ], [])

  // Ambient morning dew light particles floating gently in the crisp dawn air
  const dewParticles = useMemo(() => [
    { id: 1, left: '18%', bottom: '15%', size: 3, dur: '7.5s', delay: '0s', color: 'rgba(254, 240, 138, 0.65)' },
    { id: 2, left: '26%', bottom: '22%', size: 2, dur: '9s', delay: '-2.5s', color: 'rgba(251, 191, 36, 0.55)' },
    { id: 3, left: '34%', bottom: '12%', size: 2.5, dur: '8s', delay: '-4s', color: 'rgba(254, 215, 170, 0.6)' },
    { id: 4, left: '45%', bottom: '18%', size: 2, dur: '6.8s', delay: '-1.2s', color: 'rgba(254, 240, 138, 0.5)' },
    { id: 5, left: '58%', bottom: '25%', size: 3, dur: '10s', delay: '-5s', color: 'rgba(251, 146, 60, 0.45)' },
    { id: 6, left: '68%', bottom: '14%', size: 2, dur: '8.2s', delay: '-3s', color: 'rgba(254, 249, 195, 0.6)' },
    { id: 7, left: '76%', bottom: '20%', size: 2.5, dur: '7.8s', delay: '-6s', color: 'rgba(254, 205, 211, 0.55)' },
    { id: 8, left: '88%', bottom: '16%', size: 2, dur: '9.5s', delay: '-2s', color: 'rgba(254, 240, 138, 0.5)' },
  ], [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* ── Distant Layered Mountain Ridges on the Dawn Horizon ── */}
      <div className="absolute inset-x-0 bottom-0 h-36 pointer-events-none opacity-25 select-none">
        <svg
          viewBox="0 0 1440 180"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M0,130 L110,85 L220,115 L380,60 L510,110 L680,45 L820,95 L990,40 L1140,85 L1290,55 L1440,100 L1440,180 L0,180 Z"
            fill="url(#dawn-mountain-back)"
          />
          <path
            d="M0,150 L140,120 L290,145 L450,105 L620,135 L760,95 L910,125 L1080,90 L1240,130 L1380,105 L1440,140 L1440,180 L0,180 Z"
            fill="url(#dawn-mountain-fore)"
          />
          <defs>
            <linearGradient id="dawn-mountain-back" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#09090e" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="dawn-mountain-fore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#09090e" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ── Rising Golden-Rose Sun on the Horizon ── */}
      <div className="absolute left-[14%] bottom-[8%] select-none pointer-events-none">
        <div className="absolute -inset-32 rounded-full bg-rose-500/12 blur-[90px] animate-[sun-pulse_9s_ease-in-out_infinite]" />
        <div className="absolute -inset-20 rounded-full bg-amber-400/15 blur-[60px]" />
        <div
          className="relative h-28 w-28 rounded-full blur-md opacity-70 animate-[sun-pulse_11s_ease-in-out_infinite]"
          style={{
            background: 'radial-gradient(circle, rgba(254, 240, 138, 0.65) 0%, rgba(251, 146, 60, 0.35) 45%, rgba(244, 63, 94, 0.15) 75%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-4 rounded-full blur-lg opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(254, 249, 195, 0.7) 0%, rgba(251, 191, 36, 0.25) 55%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Crepuscular God Rays (Morning Sunbeams) ── */}
      <div className="absolute inset-0 pointer-events-none opacity-15 select-none">
        <div
          className="absolute -bottom-16 left-[12%] h-[140vh] w-36 origin-bottom bg-gradient-to-t from-amber-300/30 via-yellow-200/10 to-transparent animate-[god-ray-shimmer_9s_ease-in-out_infinite]"
          style={{ transform: 'rotate(-26deg)', filter: 'blur(32px)' }}
        />
        <div
          className="absolute -bottom-16 left-[18%] h-[130vh] w-48 origin-bottom bg-gradient-to-t from-rose-300/25 via-amber-200/10 to-transparent animate-[god-ray-shimmer_12s_ease-in-out_infinite]"
          style={{ transform: 'rotate(-18deg)', filter: 'blur(36px)', animationDelay: '-4s' }}
        />
        <div
          className="absolute -bottom-16 left-[24%] h-[120vh] w-40 origin-bottom bg-gradient-to-t from-amber-400/20 via-yellow-100/8 to-transparent animate-[god-ray-shimmer_10s_ease-in-out_infinite]"
          style={{ transform: 'rotate(-10deg)', filter: 'blur(32px)', animationDelay: '-7s' }}
        />
      </div>

      {/* ── Early Morning Soaring Swallows (Randomized Headings & Instances) ── */}
      {swallowPasses.map((pass) => (
        <div
          key={pass.id}
          className={`absolute ${pass.dir === 'rtl' ? 'animate-[bird-fly-rtl_linear_forwards]' : 'animate-[bird-fly-ltr_linear_forwards]'}`}
          style={{
            top: pass.top,
            '--drift-y': pass.driftY,
            animationDuration: pass.dur,
          }}
          onAnimationEnd={() => removeSwallowPass(pass.id)}
        >
          <div className="relative">
            {morningBirds.map((b) => (
              <div
                key={b.id}
                className="absolute"
                style={{
                  transform: `translate(${b.dx}px, ${b.dy}px) scale(${b.scale})`,
                }}
              >
                <SwallowSilhouette style={{ animationDelay: b.flapDelay }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Floating Morning Dew Light Particles ── */}
      {dewParticles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-[dew-sparkle-rise_8s_ease-in-out_infinite]"
          style={{
            left: p.left,
            bottom: p.bottom,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            animationDuration: p.dur,
            animationDelay: p.delay,
            filter: 'blur(0.5px)',
          }}
        />
      ))}

      {/* ── Soft Morning Mist Clouds ── */}
      {mistClouds.map((m) => (
        <div
          key={m.id}
          className="absolute w-[340px] h-[70px] rounded-full blur-2xl animate-[cloud-drift-slow_110s_linear_infinite]"
          style={{
            top: m.top,
            opacity: m.opacity,
            transform: `scale(${m.scale})`,
            animationDuration: m.dur,
            animationDelay: m.delay,
            background: 'linear-gradient(90deg, transparent, rgba(254, 215, 170, 0.45), rgba(254, 205, 211, 0.4), transparent)',
          }}
        />
      ))}

      {/* ── Dynamic, Non-Repeating Golden Swallowtail Butterflies ── */}
      <ButterflyFlock color="gold" />
    </div>
  )
})
