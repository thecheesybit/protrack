/**
 * Soft, slowly-drifting aurora blobs behind the app — pure CSS, GPU-friendly.
 * Tinted by the active mode's accent (via --accent) and kept subtle for the
 * obsidian aesthetic. Sits at -z-10.
 */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute -left-40 -top-40 h-[42rem] w-[42rem] animate-aurora rounded-full bg-accent/15 blur-[140px]" />
      <div
        className="absolute -right-40 top-1/4 h-[38rem] w-[38rem] animate-aurora rounded-full bg-accent-2/12 blur-[140px]"
        style={{ animationDelay: '-7s' }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[34rem] w-[34rem] animate-aurora rounded-full bg-accent/10 blur-[150px]"
        style={{ animationDelay: '-14s' }}
      />
      {/* Top vignette for depth, so chrome reads cleanly over content. */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/20 to-transparent dark:from-black/40" />
    </div>
  )
}
