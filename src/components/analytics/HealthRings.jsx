import { motion } from 'framer-motion'

const clamp01 = (x) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))

/**
 * Apple Fitness-style concentric activity rings. Three goals: focus hours today,
 * current streak, and sessions completed today. Pure SVG + Framer; data is all
 * derived client-side, so it adds zero Firestore cost.
 */
export function HealthRings({ todayMins = 0, streak = 0, sessionsToday = 0, focusGoalMin = 120 }) {
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
      value: clamp01(sessionsToday / 4),
      display: `${sessionsToday}`,
      goal: '4 / day',
    },
  ]

  const size = 168
  const stroke = 13
  const gap = 5
  const center = size / 2

  return (
    <div className="flex flex-col items-center gap-4">
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

      <div className="grid w-full grid-cols-3 gap-2">
        {rings.map((ring) => (
          <div key={ring.key} className="flex flex-col items-center text-center">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ring.color }} />
              {ring.label}
            </span>
            <span className="text-base font-bold leading-tight text-ink">{ring.display}</span>
            <span className="text-[10px] text-muted/70">{ring.goal}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
