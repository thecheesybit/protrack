import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  Heart,
  ArrowRight,
  ScanLine,
  MessageSquareHeart,
  Check,
  Loader2,
  IndianRupee,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { createPendingContribution } from '@/services/patreonService'
import { SUPPORT_UPI, USD_TO_INR } from '@/lib/constants'
import { cn } from '@/utils/cn'

const PRESETS_INR = [150, 250, 500, 1000]
const PRESETS_USD = [5, 15, 25, 50]

const spring = { type: 'spring', stiffness: 360, damping: 30 }
const panelMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18 },
}

/**
 * Aesthetic, well-finished contribution card.
 * Clean, professional, and respectful of the user's intent to support.
 */
export function ContributionCard() {
  const { user } = useAuth()
  const [phase, setPhase] = useState('amount') // amount | gateway | testimony | pending
  const [currency, setCurrency] = useState('INR')
  const [amount, setAmount] = useState('500')
  const [love, setLove] = useState('')
  const [featureNext, setFeatureNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const copyUpi = () => {
    navigator.clipboard?.writeText(SUPPORT_UPI.vpa)
    setCopied(true)
    toast.success('UPI ID copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

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
      toast.error('Failed to submit story')
      setBusy(false)
    }
  }

  const presets = currency === 'INR' ? PRESETS_INR : PRESETS_USD

  return (
    <motion.div
      layout
      transition={spring}
      className="w-full overflow-hidden rounded-2xl border border-line/60 bg-surface-2/20 p-5 backdrop-blur-md"
    >
      <AnimatePresence mode="wait">
        {/* PHASE 1: CHOOSE AMOUNT */}
        {phase === 'amount' && (
          <motion.div key="amount" {...panelMotion} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-semibold text-ink">
                Contribute
              </span>
              {/* Currency Selector */}
              <div className="flex rounded-lg border border-line/60 bg-surface/50 p-0.5">
                {['INR', 'USD'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCurrency(c)
                      setAmount(c === 'INR' ? '500' : '25')
                    }}
                    className={cn(
                      'rounded-md px-2.5 py-0.5 font-mono text-[11px] font-medium transition-all cursor-pointer',
                      currency === c
                        ? 'bg-ink text-surface font-semibold shadow-xs'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {c === 'INR' ? '₹ INR' : '$ USD'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {presets.map((val) => {
                const isSelected = numericAmount === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(String(val))}
                    className={cn(
                      'flex items-center justify-center rounded-xl border py-2 transition-all cursor-pointer font-mono text-xs',
                      isSelected
                        ? 'border-accent/40 bg-accent/10 text-accent font-semibold shadow-xs ring-1 ring-accent/20'
                        : 'border-line/60 bg-surface/40 text-muted hover:border-line hover:text-ink hover:bg-surface-2',
                    )}
                  >
                    {currency === 'INR' ? `₹${val}` : `$${val}`}
                  </button>
                )
              })}
            </div>

            {/* Custom Input */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-muted">
                {currency === 'INR' ? '₹' : '$'}
              </span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount"
                className="w-full rounded-xl border border-line/70 bg-surface/60 pl-8 pr-4 py-2 font-mono text-sm font-semibold outline-none transition-colors focus:border-accent/50 text-ink placeholder-muted/50"
              />
            </div>

            {currency === 'USD' && numericAmount > 0 && (
              <p className="font-mono text-[10px] text-muted text-center">
                ≈ ₹{inrAmount} via UPI (INR)
              </p>
            )}

            <button
              type="button"
              disabled={numericAmount <= 0}
              onClick={() => setPhase('gateway')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-accent/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:scale-100 cursor-pointer"
            >
              Continue to Gateway <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}

        {/* PHASE 2: GATEWAY SCAN */}
        {phase === 'gateway' && (
          <motion.div key="gateway" {...panelMotion} className="text-center space-y-3">
            <div className="flex items-center justify-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent">
              <ScanLine className="h-3.5 w-3.5" /> Scan with UPI App
            </div>

            <div className="mx-auto w-fit rounded-2xl bg-white p-3.5 border border-line/50 shadow-sm">
              <QRCodeSVG value={upiUri} size={145} level="M" includeMargin={false} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1 text-xl font-mono font-bold text-ink">
                <IndianRupee className="h-4.5 w-4.5" />
                {inrAmount}
              </div>
              <p className="text-xs text-muted font-medium">{SUPPORT_UPI.payeeName}</p>

              {/* Copy UPI VPA */}
              <button
                type="button"
                onClick={copyUpi}
                className="mx-auto inline-flex items-center gap-1.5 rounded-lg border border-line/60 bg-surface/70 px-2.5 py-1 font-mono text-[11px] text-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer"
                title="Click to copy UPI ID"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{SUPPORT_UPI.vpa}</span>
              </button>
            </div>

            <p className="text-[10px] text-muted leading-tight">
              Pay via GPay, PhonePe, Paytm, or BHIM. Then confirm below to appear on the Wall.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPhase('amount')}
                className="rounded-xl border border-line/60 bg-surface/40 px-3.5 py-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-ink transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setPhase('testimony')}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white shadow-sm hover:bg-accent/90 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" /> I Have Contributed
              </button>
            </div>
          </motion.div>
        )}

        {/* PHASE 3: TESTIMONY */}
        {phase === 'testimony' && (
          <motion.div key="testimony" {...panelMotion} className="space-y-3">
            <div className="flex items-center gap-1.5 font-display text-xs font-semibold text-ink">
              <MessageSquareHeart className="h-4 w-4 text-rose-400 fill-rose-400/20" /> Share your experience
            </div>

            <div>
              <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
                What do you appreciate about PRO TRACK?
              </label>
              <textarea
                autoFocus
                rows={3}
                value={love}
                onChange={(e) => setLove(e.target.value)}
                placeholder="The fluid timetable and focus scenes help me stay in flow…"
                className="w-full resize-none rounded-xl border border-line bg-surface/60 px-3.5 py-2 text-xs outline-none transition-colors focus:border-accent/50 text-ink placeholder-muted/50"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
                Feature request or note for the creator:
              </label>
              <textarea
                rows={2}
                value={featureNext}
                onChange={(e) => setFeatureNext(e.target.value)}
                placeholder="A tool or workflow you would like to see…"
                className="w-full resize-none rounded-xl border border-line bg-surface/60 px-3.5 py-2 text-xs outline-none transition-colors focus:border-accent/50 text-ink placeholder-muted/50"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-accent/90 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Heart className="h-3.5 w-3.5 fill-white/20" />
              )}
              Join the Wall of Honor
            </button>
          </motion.div>
        )}

        {/* PHASE 4: PENDING CONFIRMATION */}
        {phase === 'pending' && (
          <motion.div key="pending" {...panelMotion} className="py-4 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <Check className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-semibold font-display text-ink">Thank you for your support</h3>
            <p className="mx-auto max-w-[15rem] text-xs leading-relaxed text-muted">
              Your contribution is being verified by Ayush. Your words will be added to the Wall of Honor shortly.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
