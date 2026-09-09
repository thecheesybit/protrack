import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))

/**
 * Apple Fitness-style concentric activity rings. Three goals: focus hours today,
 * current streak, and sessions completed today. Pure SVG + Framer; data is all
 * derived client-side, so it adds zero Firestore cost.
 */
export function HealthRings({
  todayMins = 0,
  streak = 0,
  sessionsToday = 0,
  focusGoalMin = 120,
  sessionsGoal = 4,
  size = 168,
}) {
  const safeSessionsGoal = Math.max(1, sessionsGoal || 4)
  const rings = [
    {
      key: 'focus',
      label: 'Focus',
      color: '#818cf8',
      value: clamp01(todayMins / focusGoalMin),
      display: `${(todayMins / 60).toFixed(1)}h`,
      goal: `${Math.round(focusGoalMin / 60)}h goal`,
    },
    {
      key: 'streak',
      label: 'Streak',
      color: '#f59e0b',
      value: clamp01(streak / 30),
      display: `${streak}d`,
      goal: '30d goal',
    },
    {
      key: 'sessions',
      label: 'Sessions',
      color: '#10b981',
      value: clamp01(sessionsToday / safeSessionsGoal),
      display: `${sessionsToday}`,
      goal: `${safeSessionsGoal} / day`,
    },
  ]

  const isCompact = size < 145
  const stroke = isCompact ? 10 : 13
  const gap = isCompact ? 3.5 : 5
  const center = size / 2

  return (
    <div className={cn("flex flex-col items-center", isCompact ? "gap-2" : "gap-4")}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {rings.map((ring, i) => {
            const r = center - stroke / 2 - i * (stroke + gap)
            const circ = 2 * Math.PI * r
            return (
              <g key={ring.key}>
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeOpacity={0.16}
                  strokeWidth={stroke}
                />
                <motion.circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: circ * (1 - ring.value) }}
                  transition={{ type: 'spring', stiffness: 60, damping: 18, delay: i * 0.1 }}
                />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid w-full grid-cols-3 gap-1.5 sm:gap-2">
        {rings.map((ring) => (
          <div key={ring.key} className="flex flex-col items-center text-center">
            <span className={cn("flex items-center gap-1 font-medium text-muted", isCompact ? "text-[10px]" : "text-[11px]")}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ring.color }} />
              {ring.label}
            </span>
            <span className={cn("font-bold leading-tight text-ink", isCompact ? "text-sm" : "text-base")}>{ring.display}</span>
            <span className={cn("text-muted/70", isCompact ? "text-[9px]" : "text-[10px]")}>{ring.goal}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
