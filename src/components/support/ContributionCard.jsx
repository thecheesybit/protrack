import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { Heart, ArrowRight, ScanLine, MessageSquareHeart, Check, Loader2, IndianRupee } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { createPendingContribution } from '@/services/patreonService'
import { SUPPORT_UPI, USD_TO_INR } from '@/lib/constants'

const spring = { type: 'spring', stiffness: 360, damping: 30 }
const panelMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.22 },
}

/**
 * The contribution flow as one morphing card:
 *   amount → gateway (dynamic UPI QR) → testimony → pending (thank you).
 * The container animates its height (layout) while panels cross-fade. The QR is
 * a generated UPI intent that pre-fills your handle AND the exact amount.
 */
export function ContributionCard() {
  const { user } = useAuth()
  const [phase, setPhase] = useState('amount') // amount | gateway | testimony | pending
  const [currency, setCurrency] = useState('INR')
  const [amount, setAmount] = useState('')
  const [love, setLove] = useState('')
  const [featureNext, setFeatureNext] = useState('')
  const [busy, setBusy] = useState(false)

  const numericAmount = Number(amount) || 0
  const inrAmount = currency === 'USD' ? Math.round(numericAmount * USD_TO_INR) : numericAmount

  const upiUri = useMemo(() => {
    const params = new URLSearchParams({
      pa: SUPPORT_UPI.vpa,
      pn: SUPPORT_UPI.payeeName,
      am: String(inrAmount),
      cu: 'INR',
      tn: SUPPORT_UPI.note,
    })
    return `upi://pay?${params.toString()}`
  }, [inrAmount])

  const submit = async () => {
    if (busy || !user) return
    setBusy(true)
    try {
      await createPendingContribution(user, {
        amount: numericAmount,
        currency,
        love,
        featureRequest: featureNext,
      })
      setPhase('pending')
      useStore.getState().pushIsland({
        kind: 'success',
        title: 'Thank you',
        detail: 'Your contribution is being verified by Ayush.',
        duration: 5000,
      })
    } catch (err) {
      console.error('[support] contribution failed', err)
      setBusy(false)
    }
  }

  return (
    <motion.div
      layout
      transition={spring}
      className="edge-light w-full overflow-hidden rounded-3xl border border-line/70 bg-surface/60 p-5 backdrop-blur-xl"
    >
      <AnimatePresence mode="wait">
        {phase === 'amount' && (
          <motion.div key="amount" {...panelMotion}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Heart className="h-4 w-4 text-rose-400" /> Choose your contribution
            </div>
            <div className="mb-3 flex gap-2">
              {['INR', 'USD'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                    currency === c ? 'border-accent/60 bg-accent/10 text-accent' : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={currency === 'INR' ? 'Amount in ₹' : 'Amount in $'}
              className="w-full rounded-2xl border border-line/70 bg-surface-2/40 px-4 py-3 text-lg font-semibold outline-none focus:border-accent/60"
            />
            {currency === 'USD' && numericAmount > 0 && (
              <p className="mt-1.5 text-xs text-muted">≈ ₹{inrAmount} charged via UPI (INR)</p>
            )}
            <button
              disabled={numericAmount <= 0}
              onClick={() => setPhase('gateway')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Generate Contribution Gateway <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {phase === 'gateway' && (
          <motion.div key="gateway" {...panelMotion} className="text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold">
              <ScanLine className="h-4 w-4 text-accent" /> Scan to contribute
            </div>
            <div className="mx-auto w-fit rounded-2xl bg-white p-4">
              <QRCodeSVG value={upiUri} size={188} level="M" includeMargin={false} />
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                <IndianRupee className="h-5 w-5" />
                {inrAmount}
              </div>
              <p className="text-muted">{SUPPORT_UPI.payeeName} · {SUPPORT_UPI.vpa}</p>
              <p className="text-xs text-muted/70">Scan with any UPI app, then confirm below.</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPhase('amount')}
                className="rounded-2xl border border-line/70 px-4 py-3 text-sm font-medium text-muted hover:text-ink"
              >
                Back
              </button>
              <button
                onClick={() => setPhase('testimony')}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow"
              >
                <Check className="h-4 w-4" /> I Have Contributed
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'testimony' && (
          <motion.div key="testimony" {...panelMotion}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessageSquareHeart className="h-4 w-4 text-rose-400" /> Share your story
            </div>
            <label className="mb-1 block text-xs text-muted">What do you love about PRO TRACK?</label>
            <textarea
              autoFocus
              rows={3}
              value={love}
              onChange={(e) => setLove(e.target.value)}
              placeholder="The mode-switching changed how I study…"
              className="mb-3 w-full resize-none rounded-2xl border border-line/70 bg-surface-2/40 px-4 py-3 text-sm outline-none focus:border-accent/60"
            />
            <label className="mb-1 block text-xs text-muted">What should we engineer next?</label>
            <textarea
              rows={2}
              value={featureNext}
              onChange={(e) => setFeatureNext(e.target.value)}
              placeholder="A feature you'd love to see…"
              className="mb-4 w-full resize-none rounded-2xl border border-line/70 bg-surface-2/40 px-4 py-3 text-sm outline-none focus:border-accent/60"
            />
            <button
              disabled={busy}
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
              Submit contribution
            </button>
          </motion.div>
        )}

        {phase === 'pending' && (
          <motion.div key="pending" {...panelMotion} className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold">Thank you</h3>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted">
              Your contribution is being verified by Ayush. Once confirmed, you will appear on the Wall of
              Honor for everyone to see.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
