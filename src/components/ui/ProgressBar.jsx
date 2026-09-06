import { useEffect, useState } from 'react'
import { cn } from '@/utils/cn'

// Gradient pill palette (DESIGN_SYSTEM.md §5) — picked by name so callers
// never hardcode hex pairs.
const GRADIENTS = {
  'sky-violet': 'linear-gradient(90deg, #0ea5e9, #7c3aed)',
  'violet-rose': 'linear-gradient(90deg, #7c3aed, #f43f5e)',
  'rose-amber': 'linear-gradient(90deg, #f43f5e, #f59e0b)',
  'amber-sage': 'linear-gradient(90deg, #f59e0b, #4ade80)',
}

/**
 * Progress bar. `gradient` (one of sky-violet | violet-rose | rose-amber |
 * amber-sage) switches to the premium pill style and animates the fill from
 * 0 to the target on mount; plain `color` keeps the classic flat bar.
 */
export function ProgressBar({ value = 0, color, gradient, className, height = 'h-2' }) {
  const pct = Math.max(0, Math.min(100, value))

  // Mount at 0 and let the width transition carry the fill to its value —
  // one state flip, no animation loop.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const width = gradient && !mounted ? 0 : pct

  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-surface-2', height, className)}>
      <div
        className={cn(
          'h-full rounded-full transition-[width] ease-out',
          gradient ? 'duration-700' : 'duration-500',
        )}
        style={{
          width: `${width}%`,
          ...(gradient
            ? { backgroundImage: GRADIENTS[gradient] || GRADIENTS['sky-violet'] }
            : { backgroundColor: color || 'rgb(var(--accent))' }),
        }}
      />
    </div>
  )
}
