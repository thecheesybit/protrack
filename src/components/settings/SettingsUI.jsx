import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * SettingsSection — Grouping container for related settings.
 * Features Fraunces or uppercase tracking header and subtle divider.
 */
export function SettingsSection({ title, description, children, className }) {
  return (
    <section className={cn('space-y-4', className)}>
      {title && (
        <div className="flex flex-col gap-1 pb-1">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted">
            {title}
          </h4>
          {description && (
            <p className="text-xs text-muted/70 leading-relaxed font-sans">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="space-y-3.5">{children}</div>
    </section>
  )
}

/**
 * SettingsCard — Glassmorphic card container following ProTrack obsidian/parchment styling.
 * Spacious internal padding and gentle border contrast.
 */
export function SettingsCard({ children, className, hover = true }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line/45 bg-surface-2/20 backdrop-blur-md p-5 sm:p-6 transition-all duration-200 shadow-xs',
        hover && 'hover:border-line hover:bg-surface-2/35',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * SettingsToggleSwitch — Standalone animated toggle switch with smooth spring action.
 */
export function SettingsToggleSwitch({ checked, onChange, disabled = false, id, label }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1',
        checked
          ? 'bg-accent shadow-glow-xs'
          : 'bg-surface-2 border border-line/70',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
          checked ? 'translate-x-5 bg-white' : 'translate-x-0 bg-muted/60'
        )}
      />
    </button>
  )
}

/**
 * SettingsToggleRow — Full interactive row with title, description, icon, and right-aligned switch.
 * Spacious, airy, and gentle on hover.
 */
export function SettingsToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled = false,
  badge,
  badgeVariant = 'accent',
  actionSlot,
  className,
}) {
  return (
    <div
      onClick={() => !disabled && onChange?.(!checked)}
      className={cn(
        'group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-line/45 bg-surface-2/20 p-5 backdrop-blur-md transition-all duration-200 cursor-pointer select-none',
        'hover:border-line hover:bg-surface-2/35',
        checked && 'border-accent/25 bg-accent/[0.02]',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        {Icon && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors duration-200 mt-0.5',
              checked
                ? 'bg-accent/15 text-accent shadow-glow-xs'
                : 'bg-surface-2/70 border border-line/50 text-muted group-hover:text-ink'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-sans text-sm font-semibold tracking-tight text-ink">
              {title}
            </span>
            {badge && <SettingsBadge variant={badgeVariant}>{badge}</SettingsBadge>}
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted leading-relaxed font-sans">
              {description}
            </p>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-3 self-end sm:self-center shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {actionSlot}
        <SettingsToggleSwitch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          label={title}
        />
      </div>
    </div>
  )
}

/**
 * SettingsBadge — `font-mono` status pill.
 */
export function SettingsBadge({ children, variant = 'accent', className }) {
  const variants = {
    accent: 'bg-accent/15 text-accent border-accent/25',
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    muted: 'bg-surface-2 text-muted border-line/60',
    rose: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  }

  return (
    <span
      className={cn(
        'font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
        variants[variant] || variants.accent,
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * SettingsSegmentGroup — Sleek segmented control group with generous padding.
 */
export function SettingsSegmentGroup({ options, value, onChange, className }) {
  return (
    <div className={cn('flex items-center gap-2 p-1.5 rounded-2xl border border-line/60 bg-surface-2/30 backdrop-blur-md', className)}>
      {options.map((opt) => {
        const isSelected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-xl py-2.5 px-3 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer font-sans text-center',
              isSelected
                ? 'bg-accent text-white shadow-glow-xs font-bold'
                : 'text-muted hover:text-ink hover:bg-surface-2/60'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * SettingsShortcutRow — Keyboard shortcut row with crisp kbd styling.
 */
export function SettingsShortcutRow({ keys, description, category }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-line/45 bg-surface-2/20 px-3.5 py-2.5 hover:border-line/70 hover:bg-surface-2/35 transition-all">
      <div className="min-w-0 flex-1">
        <span className="font-sans text-xs font-medium text-ink/90 truncate block">
          {description}
        </span>
        {category && (
          <span className="font-mono text-[calc(0.625rem*var(--text-scale,1))] uppercase tracking-wider text-muted/60">
            {category}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {Array.isArray(keys) ? (
          keys.map((k, idx) => (
            <kbd
              key={idx}
              className="rounded-lg border border-line/80 bg-surface px-2 py-0.5 font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-semibold text-ink shadow-xs"
            >
              {k}
            </kbd>
          ))
        ) : (
          <kbd className="rounded-lg border border-line/80 bg-surface px-2 py-0.5 font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-semibold text-ink shadow-xs">
            {keys}
          </kbd>
        )}
      </div>
    </div>
  )
}

/**
 * SettingsDangerCard — Compact, elegant danger zone container with inline collapsible confirmation.
 */
export function SettingsDangerCard({
  title,
  description,
  buttonText,
  confirmPrompt,
  confirmWord = 'CONFIRM',
  onConfirm,
  loading = false,
  className,
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')

  const handleConfirm = () => {
    if (input.trim() !== confirmWord) return
    onConfirm?.()
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-rose-500/25 bg-rose-500/[0.03] p-5 transition-all duration-200',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 mt-0.5">
            <ShieldAlert className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-sm font-semibold text-rose-400">
                {title}
              </span>
              <SettingsBadge variant="rose">Danger</SettingsBadge>
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-muted leading-relaxed font-sans">
                {description}
              </p>
            )}
          </div>
        </div>

        {!open ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true)
              setInput('')
            }}
            className="self-start sm:self-center shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            {buttonText}
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-4 pt-4 border-t border-rose-500/20 space-y-3"
          >
            <p className="text-xs text-rose-300 font-medium">
              {confirmPrompt || `To proceed, type "${confirmWord}" to confirm:`}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={confirmWord}
                autoFocus
                className="flex-1 rounded-xl border border-rose-500/40 bg-surface px-3.5 py-2 text-xs text-ink outline-none focus:border-rose-500 font-mono font-bold uppercase placeholder:normal-case"
              />
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setInput('')
                }}
                disabled={loading}
                className="rounded-xl border border-line bg-surface-2/60 px-3.5 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-2 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={input.trim() !== confirmWord || loading}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-glow-sm hover:bg-rose-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? 'Processing…' : 'Confirm Action'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
