import { memo } from 'react'

/**
 * HeatHazeOverlay
 *
 * Renders atmospheric heat wave shimmer & mirage shimmer during
 * Grishma (Summer) midday and hot afternoon hours.
 */
export const HeatHazeOverlay = memo(function HeatHazeOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 opacity-40 z-0 max-w-full"
      aria-hidden="true"
    >
      {/* ── Horizon Shimmering Mirage Wave ── */}
      <div
        className="gpu-layer absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-amber-500/10 via-yellow-400/5 to-transparent blur-2xl animate-[god-ray-shimmer_7s_ease-in-out_infinite] pointer-events-none"
      />

      {/* ── Radiant Heat Glow at Midday Sun ── */}
      <div
        className="gpu-layer absolute top-0 right-1/4 w-96 h-96 rounded-full bg-amber-400/10 blur-[120px] animate-[sun-pulse_6s_ease-in-out_infinite] pointer-events-none"
      />
    </div>
  )
})
