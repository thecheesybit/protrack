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
      className="w-full overflow-hidden rounded-2xl border border-line bg-surface-2/20 p-5 shadow-sm"
    >
      <AnimatePresence mode="wait">
        {phase === 'amount' && (
          <motion.div key="amount" {...panelMotion}>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
              <Heart className="h-4 w-4 text-rose-400 fill-rose-400/20" /> Choose Contribution
            </div>
            <div className="mb-3 flex gap-2">
              {['INR', 'USD'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                    currency === c
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-line/60 bg-surface/40 text-muted hover:bg-surface-2 hover:text-ink'
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
              className="w-full rounded-xl border border-line bg-surface/40 px-4 py-2.5 text-base font-semibold outline-none transition-colors focus:border-accent/40 text-ink placeholder-muted/60"
            />
            {currency === 'USD' && numericAmount > 0 && (
              <p className="mt-1.5 text-[10px] font-medium text-muted">≈ ₹{inrAmount} charged via UPI (INR)</p>
            )}
            <button
              disabled={numericAmount <= 0}
              onClick={() => setPhase('gateway')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent/90 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:scale-100"
            >
              Generate Gateway <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}

        {phase === 'gateway' && (
          <motion.div key="gateway" {...panelMotion} className="text-center">
            <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-accent">
              <ScanLine className="h-4 w-4 animate-pulse" /> Scan to contribute
            </div>
            <div className="mx-auto w-fit rounded-xl bg-white p-3 border border-line/40 shadow-sm">
              <QRCodeSVG value={upiUri} size={150} level="M" includeMargin={false} />
            </div>
            <div className="mt-4 space-y-1 text-xs">
              <div className="flex items-center justify-center gap-1 text-xl font-black text-ink">
                <IndianRupee className="h-4.5 w-4.5" />
                {inrAmount}
              </div>
              <p className="text-muted font-medium">{SUPPORT_UPI.payeeName} · {SUPPORT_UPI.vpa}</p>
              <p className="text-[10px] font-semibold text-muted/70 uppercase tracking-wide">Scan with any UPI app, then confirm below.</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPhase('amount')}
                className="rounded-xl border border-line bg-surface/40 px-4 py-2.5 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-ink transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setPhase('testimony')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent/90 transition-all active:scale-[0.98]"
              >
                <Check className="h-3.5 w-3.5" /> I Have Contributed
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'testimony' && (
          <motion.div key="testimony" {...panelMotion}>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
              <MessageSquareHeart className="h-4 w-4 text-rose-400 fill-rose-400/20" /> Share your story
            </div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted/80">What do you love about PRO TRACK?</label>
            <textarea
              autoFocus
              rows={3}
              value={love}
              onChange={(e) => setLove(e.target.value)}
              placeholder="The mode-switching changed how I study…"
              className="mb-3 w-full resize-none rounded-xl border border-line bg-surface/40 px-4 py-2.5 text-xs outline-none transition-colors focus:border-accent/40 text-ink placeholder-muted/60"
            />
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted/80">What should we engineer next?</label>
            <textarea
              rows={2}
              value={featureNext}
              onChange={(e) => setFeatureNext(e.target.value)}
              placeholder="A feature you'd love to see…"
              className="mb-4 w-full resize-none rounded-xl border border-line bg-surface/40 px-4 py-2.5 text-xs outline-none transition-colors focus:border-accent/40 text-ink placeholder-muted/60"
            />
            <button
              disabled={busy}
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent/90 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className="h-3.5 w-3.5" />}
              Submit Story
            </button>
          </motion.div>
        )}

        {phase === 'pending' && (
          <motion.div key="pending" {...panelMotion} className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Check className="h-6 w-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-ink">Thank you</h3>
            <p className="mx-auto mt-1.5 max-w-[15rem] text-xs leading-relaxed text-muted font-medium">
              Your contribution is being verified by Ayush. Once confirmed, you will appear on the Wall of
              Honor.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
