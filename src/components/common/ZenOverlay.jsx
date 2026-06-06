import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { useIdleDetection } from '@/hooks/useIdleDetection'

import { fetchZenQuote } from '@/services/geminiService'

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr." },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem" },
]

export function ZenOverlay() {
  const { isIdle } = useIdleDetection(180000) // 3 minutes
  const [show, setShow] = useState(false)
  const [quote, setQuote] = useState(QUOTES[0])
  
  const focusRunning = useStore((s) => s.status === 'running')
  const focusLocked = useStore((s) => s.focusLocked)
  const isBlocked = focusRunning || focusLocked

  useEffect(() => {
    let active = true

    if (isBlocked) {
      setShow(false)
      return
    }

    if (isIdle) {
      const run = async () => {
        let history = []
        try {
          history = JSON.parse(localStorage.getItem('protrack:zen_history')) || []
        } catch {}
        
        // Keep last 30 quotes to avoid repeating within a month
        if (history.length > 30) history = history.slice(history.length - 30)
        
        let newQuote = await fetchZenQuote(history)
        if (!active) return
        
        if (!newQuote || !newQuote.text) {
          // Fallback to hardcoded ones that aren't in recent history if possible
          const available = QUOTES.filter(q => !history.find(h => h.text === q.text))
          newQuote = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : QUOTES[Math.floor(Math.random() * QUOTES.length)]
        }
        
        history.push({ text: newQuote.text, author: newQuote.author, date: Date.now() })
        localStorage.setItem('protrack:zen_history', JSON.stringify(history))
        
        setQuote(newQuote)
        setShow(true)
        
        // Auto dismiss after 7 seconds
        const timeout = setTimeout(() => setShow(false), 7000)
      }
      run()
    } else {
      setShow(false)
    }

    return () => {
      active = false
    }
  }, [isIdle, isBlocked])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="zen-overlay"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.2 } }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/60 p-8 text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1.2, ease: 'easeOut' }}
            className="max-w-3xl"
          >
            <p className="text-3xl font-serif italic text-ink/90 md:text-5xl leading-relaxed">
              "{quote.text}"
            </p>
            <p className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-muted">
              — {quote.author}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
