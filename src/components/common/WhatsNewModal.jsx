import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Leaf } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { APP_VERSION } from '@/lib/version'
import { CHANGELOG } from '@/content/changelog'

const SEEN_KEY = 'protrack:lastSeenVersion'
const MAX_POINTS = 7
const THANKS =
  "Thanks for keeping PRO TRACK part of your day — every release is shaped by people who keep showing up. Here's what changed."

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}
function writeSeen(v) {
  try {
    localStorage.setItem(SEEN_KEY, v)
  } catch {
    /* private mode */
  }
}

/** Light markdown → plain text for a one-line bullet (bold, code, links). */
function stripMd(s) {
  return String(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,2}(?=\S)(.+?)(?<=\S)[*_]{1,2}/g, '$1')
    .trim()
}

/**
 * Shown once, on the first launch after an update: a short thank-you plus the
 * headline changes for the running version — pulled straight from CHANGELOG.md
 * (via `content/changelog.js`), so it stays correct for every release with no
 * extra file to maintain. First-ever launch is silent (new users get
 * onboarding, not a changelog).
 */
export function WhatsNewModal() {
  const [open, setOpen] = useState(false)

  // Notes for the running build: exact-version match first, newest entry as a
  // fallback (e.g. a hotfix whose CHANGELOG heading lags the package version).
  const entry = useMemo(() => {
    const list = Array.isArray(CHANGELOG) ? CHANGELOG : []
    return list.find((e) => e.version === APP_VERSION) || list[0] || null
  }, [])

  const points = useMemo(
    () => (entry?.highlights || []).map(stripMd).filter(Boolean).slice(0, MAX_POINTS),
    [entry],
  )
  const extra = Math.max(0, (entry?.highlights?.length || 0) - points.length)

  useEffect(() => {
    const seen = readSeen()
    if (!seen) {
      // First run on this machine — don't interrupt, just record the baseline.
      writeSeen(APP_VERSION)
      return
    }
    if (seen !== APP_VERSION && points.length > 0) {
      setOpen(true)
    }
  }, [points.length])

  const dismiss = () => {
    writeSeen(APP_VERSION)
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      onClose={dismiss}
      className="max-w-lg"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Updated to v{APP_VERSION}
        </span>
      }
      footer={
        <Button size="sm" onClick={dismiss}>
          Got it
        </Button>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-muted">{THANKS}</p>
      <ul className="flex flex-col gap-2.5">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-ink">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Leaf className="h-3 w-3" />
            </span>
            <span className="leading-snug">{point}</span>
          </li>
        ))}
      </ul>
      {extra > 0 && (
        <p className="mt-3 text-xs text-muted/80">
          + {extra} more — see Settings → Changelog for the full list.
        </p>
      )}
    </Modal>
  )
}
