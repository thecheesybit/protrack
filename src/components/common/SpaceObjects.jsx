import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { FireflyField } from './FireflyField'

/**
 * Ambient night sky: a moon, shooting stars, and drifting asteroids/spacecraft.
 * Every object is spawned by JS with randomized position, direction, speed and
 * interval, then removed on animationend — so no two passes repeat the same
 * spot, timing, or heading. Only runs in the dark "starry" slots.
 */

const NIGHT_SLOTS = new Set(['deep_night', 'dawn', 'dusk', 'evening'])
const rnd = (min, max) => min + Math.random() * (max - min)
const uid = () => Math.random().toString(36).slice(2)

const MOON_SPOTS = [
  { right: '7%', top: '10%' },
  { right: '15%', top: '7%' },
  { right: '9%', top: '17%' },
  { left: '18%', top: '9%' },
]

function makeMeteor() {
  const dir = Math.random() < 0.5 ? -1 : 1 // down-left or down-right
  const distVW = rnd(30, 55)
  const fallVH = rnd(16, 34)
  return {
    id: uid(),
    top: `${rnd(1, 42)}%`,
    left: `${rnd(12, 88)}%`,
    mx: `${dir * distVW}vw`,
    my: `${fallVH}vh`,
    angle: (Math.atan2(fallVH, dir * distVW) * 180) / Math.PI,
    dur: rnd(1, 2),
    len: Math.round(rnd(90, 180)),
  }
}

function makeDrifter() {
  return {
    id: uid(),
    kind: Math.random() < 0.5 ? 'satellite' : 'rock',
    top: `${rnd(6, 68)}%`,
    driftY: `${rnd(-12, 12).toFixed(1)}vh`,
    dir: Math.random() < 0.5 ? 'drift-ltr' : 'drift-rtl',
    dur: rnd(42, 85),
    op: rnd(0.55, 0.85).toFixed(2),
  }
}

/** Generic spawner: keeps a live list, spawns on a random interval, self-cleans. */
function useSpawner(active, make, firstRange, gapRange, maxItems = 1) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!active) {
      setItems([])
      return undefined
    }
    let timer
    const spawn = () => {
      setItems((l) => (l.length >= maxItems ? l : [...l, make()]))
      timer = setTimeout(spawn, rnd(...gapRange))
    }
    timer = setTimeout(spawn, rnd(...firstRange))
    return () => clearTimeout(timer)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  const remove = (id) => setItems((l) => l.filter((x) => x.id !== id))
  return [items, remove]
}

function Asteroid() {
  return (
    <div className="relative animate-[asteroid-tumble_24s_linear_infinite] drop-shadow-md">
      <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
        {/* Craggy irregular asteroid shape with facets */}
        <polygon
          points="6,2 15,1 21,6 19,13 14,17 4,16 1,10 2,5"
          fill="#475569"
          stroke="#64748b"
          strokeWidth="0.75"
        />
        {/* Shading facets */}
        <polygon points="6,2 15,1 12,8 4,6" fill="#64748b" opacity="0.6" />
        <polygon points="15,1 21,6 16,11 12,8" fill="#334155" opacity="0.8" />
        <polygon points="14,17 4,16 8,11 16,11" fill="#1e293b" opacity="0.9" />
        {/* Small impact craters */}
        <ellipse cx="8" cy="7" rx="1.8" ry="1.4" fill="#1e293b" opacity="0.7" />
        <ellipse cx="15" cy="12" rx="1.4" ry="1.1" fill="#0f172a" opacity="0.8" />
      </svg>
    </div>
  )
}

function Satellite() {
  return (
    <div className="relative flex items-center justify-center drop-shadow-lg">
      <svg width="48" height="22" viewBox="0 0 48 22" fill="none" aria-hidden="true">
        {/* Left Solar Panel Array */}
        <rect x="1" y="5" width="15" height="12" rx="1" fill="#1e3a8a" stroke="#38bdf8" strokeWidth="0.6" />
        {/* Solar cell grid lines */}
        <line x1="6" y1="5" x2="6" y2="17" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />
        <line x1="11" y1="5" x2="11" y2="17" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />
        <line x1="1" y1="9" x2="16" y2="9" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />
        <line x1="1" y1="13" x2="16" y2="13" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />

        {/* Left Mounting Truss */}
        <line x1="16" y1="11" x2="20" y2="11" stroke="#cbd5e1" strokeWidth="1" />

        {/* Satellite Central Chassis / Bus */}
        <rect x="20" y="6" width="8" height="10" rx="1.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.7" />
        <rect x="22" y="8" width="4" height="6" fill="#f59e0b" opacity="0.8" />

        {/* Right Mounting Truss */}
        <line x1="28" y1="11" x2="32" y2="11" stroke="#cbd5e1" strokeWidth="1" />

        {/* Right Solar Panel Array */}
        <rect x="32" y="5" width="15" height="12" rx="1" fill="#1e3a8a" stroke="#38bdf8" strokeWidth="0.6" />
        <line x1="37" y1="5" x2="37" y2="17" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />
        <line x1="42" y1="5" x2="42" y2="17" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />
        <line x1="32" y1="9" x2="47" y2="9" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />
        <line x1="32" y1="13" x2="47" y2="13" stroke="#38bdf8" strokeWidth="0.4" opacity="0.8" />

        {/* Dish Antenna on top */}
        <path d="M22 6 L24 2" stroke="#94a3b8" strokeWidth="0.8" />
        <path d="M22 2 C24 0.5 26 0.5 28 2" stroke="#e2e8f0" strokeWidth="1" fill="none" />

        {/* Pulsing Telemetry Beacon LED */}
        <circle cx="24" cy="11" r="1.3" fill="#ef4444" className="animate-[beacon-blink_1.4s_infinite]" />
      </svg>
    </div>
  )
}

export function SpaceObjects() {
  const slot = useStore((s) => s.chronoSlot)
  const active = NIGHT_SLOTS.has(slot)

  // Moon position is re-rolled once per entry into a night slot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const moonSpot = useMemo(() => MOON_SPOTS[Math.floor(Math.random() * MOON_SPOTS.length)], [active])

  const [meteors, removeMeteor] = useSpawner(active, makeMeteor, [25000, 50000], [65000, 160000], 1)
  const [drifters, removeDrifter] = useSpawner(active, makeDrifter, [40000, 80000], [120000, 260000], 1)

  return (
    <div
      className="absolute inset-0 overflow-hidden transition-opacity duration-[1500ms] ease-out"
      style={{ opacity: 'var(--stars-opacity, 0)' }}
      aria-hidden="true"
    >
      {active && (
        <div className="absolute animate-moon-bob" style={moonSpot}>
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 via-slate-200 to-slate-400/80 shadow-[0_0_70px_24px_rgba(226,232,240,0.18)]">
            <span className="absolute left-3 top-4 h-2 w-2 rounded-full bg-slate-500/30" />
            <span className="absolute right-4 top-7 h-3 w-3 rounded-full bg-slate-500/25" />
            <span className="absolute bottom-3 left-6 h-1.5 w-1.5 rounded-full bg-slate-500/30" />
          </div>
        </div>
      )}

      {meteors.map((m) => (
        <div
          key={m.id}
          className="absolute"
          style={{
            top: m.top,
            left: m.left,
            '--mx': m.mx,
            '--my': m.my,
            animation: `shooting-star-once ${m.dur}s ease-in forwards`,
          }}
          onAnimationEnd={() => removeMeteor(m.id)}
        >
          <div
            className="h-[2px] rounded-full bg-gradient-to-r from-transparent to-white"
            style={{ width: m.len, transform: `rotate(${m.angle}deg)`, transformOrigin: 'left center' }}
          />
        </div>
      ))}

      {drifters.map((d) => (
        <div
          key={d.id}
          className="absolute"
          style={{ top: d.top, '--drift-op': d.op, '--drift-y': d.driftY, animation: `${d.dir} ${d.dur}s linear forwards` }}
          onAnimationEnd={() => removeDrifter(d.id)}
        >
          {d.kind === 'satellite' ? <Satellite /> : <Asteroid />}
        </div>
      ))}

      {/* ── Night Meadow Bioluminescent Fireflies ── */}
      <FireflyField count={14} />
    </div>
  )
}
