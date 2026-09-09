import { memo, useMemo, useState, useEffect } from 'react'
import { FireflyField } from './FireflyField'

const rnd = (min, max) => min + Math.random() * (max - min)
const uid = () => Math.random().toString(36).slice(2)

function makeDuskBirdPass() {
  const dir = Math.random() < 0.65 ? 'ltr' : 'rtl'
  const top = rnd(16, 42)
  const driftY = rnd(-14, 14)
  const dur = rnd(36, 54)
  return {
    id: uid(),
    dir,
    top: `${top.toFixed(1)}%`,
    driftY: `${driftY.toFixed(1)}vh`,
    dur: `${dur.toFixed(1)}s`,
  }
}

/**
 * Sunset / Dusk Sky Ambient Objects:
 * - Setting amber/crimson sun dipping into twilight
 * - Dynamic, non-repeating silhouetted bird flock passages (random headings & intervals)
 * - Twilight clouds rimmed with warm coral & violet highlights
 * - Bioluminescent fireflies beginning to glow as twilight deepens
 */
export const DuskSkyObjects = memo(function DuskSkyObjects() {
  // Dynamic non-repeating bird flock passes
  const [birdPasses, setBirdPasses] = useState(() => [])

  useEffect(() => {
    let timer
    const scheduleNext = (delayMs) => {
      timer = setTimeout(() => {
        setBirdPasses((list) => {
          if (list.length >= 1) return list
          return [...list, makeDuskBirdPass()]
        })
        scheduleNext(rnd(130000, 260000))
      }, delayMs)
    }

    // Gentle twilight bird formation returning home: occasional and soothing
    scheduleNext(rnd(35000, 70000))
    return () => clearTimeout(timer)
  }, [])

  const removeBirdPass = (id) => {
    setBirdPasses((list) => list.filter((p) => p.id !== id))
  }

  // A small flock of silhouetted birds gliding in gentle formation
  const birdFlock = useMemo(() => [
    { id: 1, dx: 0, dy: 0, scale: 1, flapDelay: '0s' },
    { id: 2, dx: 24, dy: 14, scale: 0.85, flapDelay: '-0.3s' },
    { id: 3, dx: 44, dy: 26, scale: 0.72, flapDelay: '-0.6s' },
    { id: 4, dx: -22, dy: 16, scale: 0.8, flapDelay: '-0.4s' },
    { id: 5, dx: 68, dy: 38, scale: 0.65, flapDelay: '-0.8s' },
  ], [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* ── The Evening Star (Venus / Hesperus) ── */}
      <div className="absolute left-[22%] top-[14%] select-none pointer-events-none animate-[evening-star-glint_6s_ease-in-out_infinite]">
        <div className="absolute -inset-4 rounded-full bg-amber-200/20 blur-md" />
        <svg width="18" height="18" viewBox="0 0 18 18" className="fill-amber-100/90 drop-shadow-[0_0_6px_rgba(254,240,138,0.8)]">
          <path d="M9,0 Q9,9 0,9 Q9,9 9,18 Q9,9 18,9 Q9,9 9,0 Z" />
        </svg>
      </div>

      {/* ── Setting Coral Sun ── */}
      <div className="absolute right-[18%] bottom-[8%] select-none pointer-events-none">
        <div className="absolute -inset-28 rounded-full bg-rose-600/15 blur-[90px] animate-[sun-pulse_7s_ease-in-out_infinite]" />
        <div className="absolute -inset-16 rounded-full bg-amber-500/18 blur-[60px]" />
        <div
          className="relative h-24 w-24 rounded-full blur-md opacity-75 animate-[sun-pulse_9s_ease-in-out_infinite]"
          style={{
            background: 'radial-gradient(circle, rgba(251, 146, 60, 0.65) 0%, rgba(244, 63, 94, 0.35) 45%, rgba(168, 85, 247, 0.15) 75%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-3 rounded-full blur-lg opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(254, 215, 170, 0.7) 0%, rgba(251, 146, 60, 0.25) 60%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Twilight Horizon Clouds ── */}
      <div
        className="absolute bottom-[18%] left-[5%] w-[420px] h-[75px] rounded-full blur-2xl animate-[cloud-drift-slow_120s_linear_infinite]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.35), rgba(251, 146, 60, 0.4), transparent)',
          opacity: 0.35,
        }}
      />
      <div
        className="absolute bottom-[28%] right-[10%] w-[380px] h-[65px] rounded-full blur-2xl animate-[cloud-drift-slow_100s_linear_infinite]"
        style={{
          animationDelay: '-35s',
          background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.3), rgba(244, 63, 94, 0.35), transparent)',
          opacity: 0.3,
        }}
      />

      {/* ── Silhouetted Flock of Birds (Dynamic Non-Repeating Passages) ── */}
      {birdPasses.map((pass) => (
        <div
          key={pass.id}
          className={`absolute ${pass.dir === 'rtl' ? 'animate-[bird-fly-rtl_linear_forwards]' : 'animate-[bird-fly-ltr_linear_forwards]'}`}
          style={{
            top: pass.top,
            '--drift-y': pass.driftY,
            animationDuration: pass.dur,
          }}
          onAnimationEnd={() => removeBirdPass(pass.id)}
        >
          <div className="relative">
            {birdFlock.map((b) => (
              <div
                key={b.id}
                className="absolute"
                style={{
                  transform: `translate(${b.dx}px, ${b.dy}px) scale(${b.scale})`,
                }}
              >
                <svg
                  width="20"
                  height="12"
                  viewBox="0 0 20 12"
                  className="animate-[bird-flap_1.6s_ease-in-out_infinite]"
                  style={{ animationDelay: b.flapDelay }}
                >
                  <path
                    d="M0 6 C4 1, 8 1, 10 5 C12 1, 16 1, 20 6 C16 4, 12 4, 10 7 C8 4, 4 4, 0 6 Z"
                    fill="#1e1b4b"
                    opacity="0.7"
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ── Twilight Bioluminescent Fireflies ── */}
      <FireflyField count={10} />
    </div>
  )
})
