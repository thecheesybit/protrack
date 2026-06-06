import { Heart, Github, BadgeCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { WidgetFrame } from './WidgetFrame'
import { ContributionCard } from '@/components/support/ContributionCard'
import { WallOfHonor } from '@/components/support/WallOfHonor'
import { useIsPatreon } from '@/hooks/useWall'
import { CREATOR } from '@/lib/constants'

/**
 * Support Corner — an open-source "monument". PRO TRACK is entirely free with no
 * paywall or locked features; this module lets passionate users crowd-fund the
 * servers. Compact in the grid; the full flow + Wall of Honor open in hero.
 */
export function SupportWidget({ widget, variant }) {
  const { user } = useAuth()
  const isPatreon = useIsPatreon(user?.uid)
  const isHero = variant === 'hero'

  const Philosophy = (
    <div className="rounded-2xl border border-line/50 bg-gradient-to-br from-accent/10 to-accent-2/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Heart className="h-4 w-4 text-rose-400" /> PRO TRACK is free, forever
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        No premium tier, no paywall, no locked features — everyone runs the latest, most powerful
        version. If it helps you, help us keep the servers running.
      </p>
      <a
        href={CREATOR.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      >
        <Github className="h-3.5 w-3.5" /> Open-source by {CREATOR.name}
      </a>
    </div>
  )

  return (
    <WidgetFrame
      widget={widget}
      variant={variant}
      subtitle="Keep PRO TRACK free"
      headerActions={
        isPatreon ? (
          <span className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" /> Patron
          </span>
        ) : null
      }
    >
      {isHero ? (
        <div className="flex h-full flex-col gap-4 overflow-y-auto lg:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[22rem]">
            {Philosophy}
            {isPatreon ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                <BadgeCheck className="h-8 w-8 text-emerald-400" />
                <p className="text-sm font-semibold">You are an Established Patron</p>
                <p className="text-xs text-muted">Thank you for keeping PRO TRACK alive for everyone.</p>
              </div>
            ) : (
              <ContributionCard />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <WallOfHonor />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
          {Philosophy}
          {!isPatreon && (
            <p className="text-center text-xs text-muted">Open to contribute and view the Wall of Honor.</p>
          )}
        </div>
      )}
    </WidgetFrame>
  )
}
