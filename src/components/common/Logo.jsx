import logo from '@/assets/a9.png'
import { cn } from '@/utils/cn'

/**
 * The PRO TRACK mark (a9.png). Use everywhere we'd otherwise draw a glyph,
 * so the brand stays consistent across auth, top bar, tray, and installers.
 */
export function Logo({ className, withWordmark = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={logo}
        alt="PRO TRACK"
        draggable={false}
        className={cn('select-none object-contain', className || 'h-9 w-9')}
      />
      {withWordmark && (
        <span className="text-lg font-bold tracking-tight">PRO TRACK</span>
      )}
    </span>
  )
}
