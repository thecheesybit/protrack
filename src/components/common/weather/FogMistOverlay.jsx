import { memo } from 'react'

/**
 * FogMistOverlay
 *
 * Renders atmospheric morning winter mist (Kohra / Kuhaasa) rolling gently
 * across the lower atmosphere during Shishir (Winter) and Hemant dawn/morning hours.
 */
export const FogMistOverlay = memo(function FogMistOverlay({ intensity = 'moderate' }) {
  const opacityClass =
    intensity === 'heavy' ? 'opacity-45' : intensity === 'moderate' ? 'opacity-30' : 'opacity-20'

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1500 z-0 max-w-full ${opacityClass}`}
      aria-hidden="true"
    >
      {/* ── Lower Horizon Fog Blanket ── */}
      <div
        className="gpu-layer absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-slate-200/50 via-slate-100/25 to-transparent blur-3xl pointer-events-none"
      />

      {/* ── Mid-Level Drifting Mist Banks ── */}
      <div
        className="gpu-layer absolute bottom-16 -left-32 w-[140vw] h-32 rounded-full bg-slate-200/40 blur-3xl animate-[cloud-drift-slow_80s_linear_infinite] pointer-events-none"
      />
      <div
        className="gpu-layer absolute bottom-32 -left-20 w-[120vw] h-28 rounded-full bg-sky-100/30 blur-3xl animate-[cloud-drift-mid_95s_linear_infinite] pointer-events-none"
        style={{ animationDelay: '-30s' }}
      />
    </div>
  )
})
