import { useState } from 'react'
import { Target, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

const FOCUS_PRESETS = [
  { label: '1h', mins: 60 },
  { label: '2h', mins: 120 },
  { label: '3h', mins: 180 },
  { label: '4h', mins: 240 },
  { label: '6h', mins: 360 },
  { label: '8h', mins: 480 },
]

const SESSIONS_PRESETS = [2, 3, 4, 5, 6, 8]

export function AnalyticsGoalsModal({ open, onClose, currentGoals, onSave }) {
  const [focusMin, setFocusMin] = useState(currentGoals?.focusGoalMin || 120)
  const [sessions, setSessions] = useState(currentGoals?.sessionsGoal || 4)

  const handleSave = () => {
    onSave({ focusGoalMin: focusMin, sessionsGoal: sessions })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customize Activity Goals"
      description="Set your daily targets for focus time and completed sessions to calibrate your Health Rings."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Goals
          </Button>
        </>
      }
    >
      <div className="space-y-6 py-2">
        {/* Focus Goal Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink">Daily Focus Time</span>
            <span className="text-sm font-bold text-accent">
              {(focusMin / 60).toFixed(1)} hours ({focusMin}m)
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {FOCUS_PRESETS.map((p) => {
              const active = focusMin === p.mins
              return (
                <button
                  key={p.mins}
                  type="button"
                  onClick={() => setFocusMin(p.mins)}
                  className={cn(
                    'flex items-center justify-center rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer border',
                    active
                      ? 'border-accent bg-accent/20 text-accent shadow-sm'
                      : 'border-line/60 bg-surface/50 text-muted hover:border-line hover:text-ink'
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <input
            type="range"
            min={30}
            max={480}
            step={15}
            value={focusMin}
            onChange={(e) => setFocusMin(Number(e.target.value))}
            className="w-full accent-accent cursor-pointer"
          />
        </div>

        {/* Sessions Goal Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-ink">Daily Completed Sessions</span>
            <span className="text-sm font-bold text-emerald-500">
              {sessions} {sessions === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {SESSIONS_PRESETS.map((count) => {
              const active = sessions === count
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSessions(count)}
                  className={cn(
                    'flex items-center justify-center rounded-xl py-2 text-xs font-semibold transition-all cursor-pointer border',
                    active
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500 shadow-sm'
                      : 'border-line/60 bg-surface/50 text-muted hover:border-line hover:text-ink'
                  )}
                >
                  {count}
                </button>
              )
            })}
          </div>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={sessions}
            onChange={(e) => setSessions(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
        </div>
      </div>
    </Modal>
  )
}
