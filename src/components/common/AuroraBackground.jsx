import { memo } from 'react'
import { SpaceObjects } from './SpaceObjects'

/**
 * Deterministic starfield — fixed seed so the sky never re-shuffles between
 * renders. Visibility rides `--stars-opacity` (0 in light slots; up to 0.9 at
 * deep night), so the layer costs nothing while invisible.
 */
const STARS = (() => {
  let seed = 42
  const rand = () => {
    // Park–Miller PRNG — tiny, deterministic, good enough for star scatter.
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 110 }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 70,
    r: rand() < 0.8 ? 0.9 : 1.6,
    // Varied delay AND duration so stars twinkle out of sync, like a real sky.
    delay: rand() * 5,
    dur: 2.2 + rand() * 4.5, // 2.2s–6.7s
  }))
})()

/**
 * Ambient canvas behind the app: aurora blobs + the 7-slot sky layer
 * (per-slot gradient wash via --sky-wash, starfield + space objects at
 * dusk/evening/deep night via --stars-opacity). Pure CSS/SVG, GPU-friendly,
 * sits at -z-10. Tinted by the chrono accent (--accent), by useChronoTheme.
 */
export const AuroraBackground = memo(function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />

      {/* Sky wash — the slot's signature gradient breathing down from the top. */}
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
        style={{ background: 'var(--sky-wash, transparent)' }}
      />

      {/* Starfield — only visible in the dark slots. */}
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

      {/* Moon, meteors, asteroid, spacecraft — night slots only. */}
      <SpaceObjects />

      {/* Ambient layer — intensity rides the chrono slot (dimmer at night). */}
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms] ease-out"
        style={{ opacity: 'var(--aurora-opacity, 1)' }}
      >
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute -left-40 -top-40 h-[42rem] w-[42rem] animate-aurora rounded-full bg-accent/15 blur-[140px]" />
        <div
          className="absolute -right-40 top-1/4 h-[38rem] w-[38rem] animate-aurora rounded-full bg-accent-2/12 blur-[140px]"
          style={{ animationDelay: '-7s' }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[34rem] w-[34rem] animate-aurora rounded-full bg-accent/10 blur-[150px]"
          style={{ animationDelay: '-14s' }}
        />
      </div>
      {/* Top vignette for depth, so chrome reads cleanly over content. */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/20 to-transparent dark:from-black/40" />
    </div>
  )
})
