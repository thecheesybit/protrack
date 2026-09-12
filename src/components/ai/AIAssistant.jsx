import { useState, useEffect } from 'react'
import { Sparkles, Mic, X, MessageSquare, AudioLines } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatTab } from './ChatTab'
import { VoiceNotesTab } from './VoiceNotesTab'
import { HandsFreeTab } from './HandsFreeTab'
import { cn } from '@/utils/cn'

export function AIAssistant() {
  const open = useStore((s) => s.aiOpen)
  const setAiOpen = useStore((s) => s.setAiOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  // 'chat' | 'voice' | 'notes'
  const [tab, setTab] = useState('chat')

  const openSettings = () => {
    setAiOpen(false)
    setSettingsOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setAiOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setAiOpen])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 md:p-8"
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setAiOpen(false)} aria-hidden="true" />

          {/* Main Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-companion-title"
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative w-full max-w-5xl h-[80vh] overflow-hidden rounded-3xl border border-line bg-surface/90 shadow-glass backdrop-blur-3xl flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line/60 p-4 md:p-6 shrink-0">
              <div className="flex flex-col items-start leading-tight">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-accent animate-pulse" />
                  <h3 id="ai-companion-title" className="text-base font-bold tracking-tight text-ink">AI Companion</h3>
                </div>
                <span className="text-[10px] text-muted font-semibold mt-1">
                  Chat, talk hands-free, or capture a voice note
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Tab switcher */}
                <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/40 p-1">
                  {[
                    { id: 'chat', label: 'Chat', Icon: MessageSquare },
                    { id: 'voice', label: 'Voice', Icon: AudioLines },
                    { id: 'notes', label: 'Note', Icon: Mic },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                        tab === id
                          ? 'bg-accent/10 text-accent'
                          : 'text-muted hover:text-ink hover:bg-surface-2',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  className="rounded-xl border border-line/60 bg-surface-2/40 p-2 text-muted transition-colors hover:text-ink hover:bg-surface-2"
                  aria-label="Close AI Companion"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-2/5">
              {tab === 'notes' ? (
                <VoiceNotesTab onOpenSettings={openSettings} />
              ) : tab === 'voice' ? (
                <HandsFreeTab />
              ) : (
                <ChatTab
                  onOpenSettings={openSettings}
                  onToggleVoiceNote={() => setTab('notes')}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
