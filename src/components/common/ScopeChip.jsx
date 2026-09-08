import { cn } from '@/utils/cn'

/**
 * Tiny presentational scope indicator for cross-module views (P7). Shows which
 * mode / scope an item belongs to — a colour dot plus a label — so items pulled
 * into a global or cross-linked list stay legible. Purely visual: the caller
 * resolves the mode name/colour and passes them in.
 *
 * @param {{ label: string, color?: string, onClick?: () => void,
 *           className?: string }} props
 */
export function ScopeChip({ label, color = 'var(--accent, #6366f1)', onClick, className = '' }) {
  if (!label) return null
  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'span'
  return (
    <Tag
      {...(interactive ? { type: 'button', onClick } : {})}
      title={label}
      className={cn(
        'inline-flex max-w-[10rem] items-center gap-1.5 rounded-full border border-line/60 bg-surface/60 px-2 py-0.5 text-[11px] font-medium text-muted',
        interactive && 'transition-colors hover:border-accent/40 hover:text-ink',
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{label}</span>
    </Tag>
  )
}
