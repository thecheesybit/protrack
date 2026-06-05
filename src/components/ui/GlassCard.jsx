import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

/** The signature surface: frosted glass with a hairline border. */
export const GlassCard = forwardRef(function GlassCard(
  { className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-3xl border border-line/70 bg-surface/60 shadow-glass backdrop-blur-xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})
