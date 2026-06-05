/**
 * Soft, slowly-drifting aurora blobs behind the app — cheap (pure CSS),
 * GPU-friendly, and key to the premium ambient feel. Sits at -z-10.
 */
export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-bg" />
      <div className="absolute inset-0 bg-grid opacity-40" />
      <div className="absolute -left-32 -top-32 h-[40rem] w-[40rem] animate-aurora rounded-full bg-accent/20 blur-[120px]" />
      <div
        className="absolute -right-32 top-1/4 h-[36rem] w-[36rem] animate-aurora rounded-full bg-accent-2/20 blur-[120px]"
        style={{ animationDelay: '-7s' }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[32rem] w-[32rem] animate-aurora rounded-full bg-accent/10 blur-[120px]"
        style={{ animationDelay: '-14s' }}
      />
    </div>
  )
}
