import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { normalizeTag, toHashtag } from '@/lib/tags'

/**
 * Tiny presentational tag chip for the unified tag layer (P7). Renders a
 * normalized tag as `#tag`. Optional `onClick` (e.g. filter by this tag) and
 * `onRemove` (e.g. detach from an item). Purely visual — no store access.
 *
 * @param {{ tag: string, onClick?: () => void, onRemove?: () => void,
 *           active?: boolean, className?: string }} props
 */
export function TagPill({ tag, onClick, onRemove, active = false, className = '' }) {
  const slug = normalizeTag(tag)
  if (!slug) return null
  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'span'
  return (
    <Tag
      {...(interactive ? { type: 'button', onClick } : {})}
      title={toHashtag(slug)}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
        active
          ? 'border-accent/40 bg-accent/15 text-accent'
          : 'border-line/60 bg-surface/60 text-muted',
        interactive && !active && 'hover:border-accent/40 hover:text-ink',
        className,
      )}
    >
      <span className="opacity-60">#</span>
      {slug}
      {typeof onRemove === 'function' && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${toHashtag(slug)}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onRemove()
            }
          }}
          className="-mr-0.5 ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-muted hover:bg-line/40 hover:text-ink"
        >
          <X className="h-2.5 w-2.5" />
        </span>
      )}
    </Tag>
  )
}
