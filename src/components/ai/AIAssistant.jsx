import { useState } from 'react'
import { Sparkles, MessageCircle, Mic } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Sheet } from '@/components/ui/Sheet'
import { ChatTab } from './ChatTab'
import { VoiceNotesTab } from './VoiceNotesTab'
import { cn } from '@/utils/cn'

function TabBtn({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
        active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function AIAssistant() {
  const open = useStore((s) => s.aiOpen)
  const setAiOpen = useStore((s) => s.setAiOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const [tab, setTab] = useState('chat')

  const openSettings = () => {
    setAiOpen(false)
    setSettingsOpen(true)
  }

  return (
    <Sheet
      open={open}
      onClose={() => setAiOpen(false)}
      title="AI Companion"
      icon={<Sparkles className="h-5 w-5 text-accent" />}
    >
      <div className="flex gap-1 border-b border-line/60 px-3 py-2">
        <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')} icon={<MessageCircle className="h-4 w-4" />}>
          Chat
        </TabBtn>
        <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')} icon={<Mic className="h-4 w-4" />}>
          Voice Notes
        </TabBtn>
      </div>

      {tab === 'chat' ? (
        <ChatTab onOpenSettings={openSettings} />
      ) : (
        <VoiceNotesTab onOpenSettings={openSettings} />
      )}
    </Sheet>
  )
}
