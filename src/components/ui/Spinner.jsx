import { cn } from '@/utils/cn'

export function Spinner({ className }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent',
        className,
      )}
    />
  )
}
