import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

const VARIANTS = {
  primary:
    'bg-accent text-white hover:bg-accent/90 shadow-glow active:scale-[0.98]',
  secondary:
    'bg-surface-2 text-ink hover:bg-surface-2/70 border border-line active:scale-[0.98]',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2/60',
  danger: 'text-red-400 hover:bg-red-500/10',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-10 w-10 justify-center',
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', type = 'button', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})
