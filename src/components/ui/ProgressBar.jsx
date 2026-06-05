import { cn } from '@/utils/cn'

export function ProgressBar({ value = 0, color, className, height = 'h-2' }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-surface-2', height, className)}>
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color || 'rgb(var(--accent))' }}
      />
    </div>
  )
}
