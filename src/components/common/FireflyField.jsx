import { memo, useMemo } from 'react'

/**
 * Bioluminescent Firefly Field for Dusk and Night themes.
 * Renders tiny glowing phosphor orbs with wandering flight paths
 * and pulsating warm amber/chartreuse luminescence.
 */
const rnd = (min, max) => min + Math.random() * (max - min)
const uid = () => Math.random().toString(36).slice(2)

export const FireflyField = memo(function FireflyField({ count = 12 }) {
  const fireflies = useMemo(() => {
    return Array.from({ length: count }, () => ({
      id: uid(),
      left: `${rnd(3, 95).toFixed(1)}%`,
      bottom: `${rnd(4, 48).toFixed(1)}%`,
      size: rnd(2.2, 3.8).toFixed(1),
      glowDur: `${rnd(2.4, 4.4).toFixed(1)}s`,
      glowDelay: `-${rnd(0, 4).toFixed(1)}s`,
      wanderDur: `${rnd(8, 16).toFixed(1)}s`,
      wanderDelay: `-${rnd(0, 8).toFixed(1)}s`,
    }))
  }, [count])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {fireflies.map((f) => (
        <div
          key={f.id}
          className="absolute animate-[firefly-wander_10s_ease-in-out_infinite]"
          style={{
            left: f.left,
            bottom: f.bottom,
            animationDuration: f.wanderDur,
            animationDelay: f.wanderDelay,
          }}
        >
          <div
            className="rounded-full animate-[firefly-glow_3s_ease-in-out_infinite]"
            style={{
              width: `${f.size}px`,
              height: `${f.size}px`,
              backgroundColor: '#fef08a',
              animationDuration: f.glowDur,
              animationDelay: f.glowDelay,
            }}
          />
        </div>
      ))}
    </div>
  )
})
