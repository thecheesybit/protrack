import { Heart, Github, BadgeCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { ContributionCard } from './ContributionCard'
import { WallOfHonor } from './WallOfHonor'
import { useIsPatreon } from '@/hooks/useWall'
import { CREATOR } from '@/lib/constants'

export function SupportModal({ open, onClose }) {
  const { user } = useAuth()
  const isPatreon = useIsPatreon(user?.uid)

  const Philosophy = (
    <div className="rounded-2xl border border-line/50 bg-gradient-to-br from-accent/10 to-accent-2/5 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Heart className="h-4 w-4 text-rose-400" /> PRO TRACK is free, forever
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        No premium tier, no paywall, no locked features — everyone runs the latest, most powerful
        version. If it helps you, help us keep the servers running.
      </p>
      <a
        href={CREATOR.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      >
        <Github className="h-3.5 w-3.5" /> Open-source by {CREATOR.name}
      </a>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Support Corner"
      className="max-w-4xl w-full"
    >
      <div className="flex flex-col gap-5 md:flex-row max-h-[70vh] overflow-y-auto pr-1">
        <div className="flex w-full shrink-0 flex-col gap-4 md:w-[22rem]">
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
    </Modal>
  )
}
